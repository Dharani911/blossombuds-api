package com.blossombuds.service;

import com.blossombuds.domain.Order;
import com.blossombuds.domain.OrderItem;
import com.blossombuds.domain.Setting;
import com.blossombuds.repository.OrderItemRepository;
import com.blossombuds.repository.OrderRepository;
import com.blossombuds.repository.ProductImageRepository;
import com.blossombuds.domain.ProductImage;
import com.lowagie.text.*;
import com.lowagie.text.pdf.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.hibernate.LazyInitializationException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

/** PDF generator for invoices & packing slips using OpenPDF (minimal, template-friendly). */
@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class PrintService {

    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final ProductImageRepository productImageRepository;
    private final SettingsService settingsService;

    @Value("${app.mail.logo.png:static/BB_logo.png}")
    private String logoPngPath;

    @Value("${app.mail.logo.svg:static/BB_logo.svg}")
    private String logoSvgPath;

    /** Generates invoice PDF bytes for a given order id. */
    @Transactional(readOnly = true, propagation = Propagation.NOT_SUPPORTED)
    public byte[] renderInvoicePdf(Long orderId) {
        if (orderId == null) throw new IllegalArgumentException("orderId is required");
        log.info("[PRINT][INVOICE] Generating invoice for orderId={}", orderId);

        // Fetch with geo to avoid lazy issues
        Order order = orderRepository.findByIdWithShipGeo(orderId)
                .orElseThrow(() -> {
                    log.warn("[PRINT][INVOICE] Order not found for orderId={}", orderId);
                    return new IllegalArgumentException("Order not found: " + orderId);
                });
        List<OrderItem> items = orderItemRepository.findByOrder_Id(orderId);
        log.debug("[PRINT][INVOICE] Fetched {} order items for orderId={}", items.size(), orderId);

        String brandName    = safe(setting("brand.name", "Blossom & Buds"));
        String fromAddress  = safe(setting("brand.address", "Chennai, TN"));
        String supportEmail = safe(setting("brand.support_email", "support@example.com"));
        String supportPhone = safe(setting("brand.whatsapp", "+91-00000-00000"));
        log.debug("[PRINT][INVOICE] Settings loaded: brandName='{}', supportEmail='{}'", brandName, supportEmail);

        byte[] pdfBytes= buildPdf(doc -> {
            doc.add(brandHeader(brandName + " — Tax Invoice", /*uppercase*/ false, logoUrl(), logoMaxH()));

            doc.add(new Paragraph("Order: " + displayPublicCode(order.getPublicCode())));
            doc.add(new Paragraph("Placed: " + fmt(order.getCreatedAt())));
            doc.add(new Paragraph("Invoice To: " + safe(order.getShipName())));
            doc.add(new Paragraph(joinLines(
                    safe(order.getShipLine1()),
                    safe(order.getShipLine2()),
                    // lazy-safe accessors
                    mergeCityStatePin(
                            safeDistrictName(order),
                            safeStateName(order),
                            safe(order.getShipPincode())
                    ),
                    safeCountryName(order)
            )));
            doc.add(spacer());

            doc.add(itemsTable(items));

            doc.add(spacerSmall());
            BigDecimal subtotal = nvl(order.getItemsSubtotal());
            BigDecimal shipping = nvl(order.getShippingFee());
            BigDecimal discount = nvl(order.getDiscountTotal());
            BigDecimal grand    = nvl(order.getGrandTotal());

            PdfPTable totals = new PdfPTable(new float[]{6f, 2f});
            totals.setWidthPercentage(100);
            totals.addCell(kvCell("Subtotal", subtotal.toPlainString()));
            totals.addCell(kvCell("Shipping", shipping.toPlainString()));
            totals.addCell(kvCell("Discounts", "-" + discount.toPlainString()));
            totals.addCell(kvCellBold("Grand Total (" + safe(order.getCurrency()) + ")", grand.toPlainString(), true));
            doc.add(totals);

            doc.add(spacer());
            doc.add(new Paragraph("From: " + fromAddress));
            doc.add(new Paragraph("Support: " + supportEmail + " / " + supportPhone));
        });
        log.info("[PRINT][INVOICE] Invoice PDF generated for orderId={}, size={} bytes", orderId, pdfBytes.length);
        return pdfBytes;
    }

    /** Generates packing slip PDF bytes for a given order id (no pricing). */
    @Transactional(readOnly = true, propagation = Propagation.SUPPORTS, noRollbackFor = Exception.class)
    public byte[] renderPackingSlipPdf(Long orderId) {
        if (orderId == null) throw new IllegalArgumentException("orderId is required");
        log.info("[PRINT][PACKING_SLIP] Generating packing slip for orderId={}", orderId);

        Order order = orderRepository.findByIdWithShipGeo(orderId)
                .orElseGet(() -> {
                    log.debug("[PRINT][PACKING_SLIP] Fallback to lazy fetch for orderId={}", orderId);
                    return orderRepository.findById(orderId)
                            .orElseThrow(() -> new IllegalArgumentException("Order not found: " + orderId));
                });
        List<OrderItem> items = orderItemRepository.findByOrder_Id(orderId);
        log.debug("[PRINT][PACKING_SLIP] Retrieved {} items for orderId={}", items.size(), orderId);

        // Settings
        String brandName   = safe(setting("brand.name", "Blossom Buds Floral Artistry")).toUpperCase();
        String fromAddress = safe(setting("brand.address",
                "Blossom Buds Floral Artistry\n12, Market Road\nChennai, TN 600001\nPhone: +91 9XXXXXXXXX"));

        // Data (strings only to avoid lazy-loading nested entities)
        String orderCode     = safe(order.getPublicCode());
        String customerName  = safe(order.getShipName());
        String customerPhone = safe(order.getShipPhone());
        String notes         = safe(order.getOrderNotes());
        String courier       = safe(order.getCourierName());

        BigDecimal itemsSubtotal = nvl(order.getItemsSubtotal());
        BigDecimal shipping      = nvl(order.getShippingFee());
        BigDecimal grand         = nvl(order.getGrandTotal());
        BigDecimal discount      = nvl(order.getDiscountTotal());

        final String toBlock = joinLines(
                customerName + (order.getCustomerId() != null && !orderCode.isBlank() ? " (BB" + orderCode + ")" :
                        order.getCustomerId() != null ? " (" + order.getCustomerId() + ")" :
                                !orderCode.isBlank() ? " (BB" + orderCode + ")" : ""),
                safe(order.getShipLine1()),
                safe(order.getShipLine2()),
                mergeCityStatePin(
                        safeDistrictName(order),
                        safeStateName(order),
                        safe(order.getShipPincode())
                ),
                safeCountryName(order),
                (customerPhone.isBlank() ? "" : "Phone: " + customerPhone)
        );

        byte[] pdf= buildPdfWithWriter((doc, writer) -> {
            // Page geometry
            Rectangle page = doc.getPageSize();
            float left   = doc.left();
            float right  = doc.right();
            float top    = doc.top();
            float bottom = doc.bottom();

            // Reserve a compact zone at the bottom for addresses (TO/FROM)
            float bottomZoneHeight = 175f; // compact address zone height
            float lineGap          = 10f;  // small gap between line and addresses
            float yCut             = bottom + bottomZoneHeight + lineGap; // line sits just above addresses

            // Draw the cut/fold line exactly above the addresses
            writer.setPageEvent(new CutFoldLineEvent(yCut));

            // Top guard so content never kisses the line
            float guardTop = 12f;

            // ───────────────── TOP FRAME 1: Header + Meta + Notes + "ITEMS" header ─────────────────
            ColumnText topCt = new ColumnText(writer.getDirectContent());
            topCt.setSimpleColumn(left, yCut + guardTop, right, top);

            // Brand
            topCt.addElement(brandHeader(brandName, /*uppercase*/ true, logoUrl(), logoMaxH()));


            // Meta row
            PdfPTable hdr = new PdfPTable(new float[]{2.2f, 2f, 2.2f, 2.2f});
            hdr.setWidthPercentage(100);
            hdr.getDefaultCell().setBorder(Rectangle.NO_BORDER);
            hdr.addCell(noBorder(td("Order #: " + (orderCode.isBlank() ? order.getId() : orderCode))));
            hdr.addCell(noBorder(td("Date: " + fmtDate(order.getCreatedAt()))));
            hdr.addCell(noBorder(td("Customer: " + (customerName.isBlank() ? "—" : customerName))));
            hdr.addCell(noBorder(td("Phone: " + (customerPhone.isBlank() ? "—" : customerPhone))));
            topCt.addElement(hdr);

            if (!notes.isBlank()) {
                Paragraph p = new Paragraph("Order Notes: \"" + notes + "\"",
                        new Font(Font.HELVETICA, 10, Font.NORMAL));
                p.setSpacingBefore(8f);   // ↑ a bit more breathing room
                p.setSpacingAfter(8f);    // ↓ so it won’t touch the ITEMS header
                topCt.addElement(p);
            }

            Paragraph itemsHdr = new Paragraph("ITEMS", new Font(Font.HELVETICA, 11, Font.BOLD));
            itemsHdr.setSpacingBefore(6f);
            itemsHdr.setSpacingAfter(6f); // space after ensures separation from first item
            topCt.addElement(itemsHdr);

            // Lay out the above and capture the remaining top Y line
            topCt.go();
            float itemsTopY = topCt.getYLine();
            if (itemsTopY <= 0 || Float.isNaN(itemsTopY)) {
                itemsTopY = top - 90f; // conservative fallback
            }
            itemsTopY -= 6f; // tiny padding just below the "ITEMS" header

            // Reserve a band for totals just above the cut line
            float totalsBandHeight = 64f;
            float itemsBottomY     = yCut + totalsBandHeight + 6f; // items must stay above this

            // ───────────────── TOP FRAME 2: Multi-column items (bounded) ─────────────────
            int n = items.size();
            int cols = (n > 24) ? 3 : (n > 12 ? 2 : 1); // auto-expand columns
            float colGap = 12f;
            float colWidth = (right - left - (colGap * (cols - 1))) / cols;

            Font fItem = new Font(Font.HELVETICA, 11, Font.NORMAL);
            Font fVar  = new Font(Font.HELVETICA, 10, Font.ITALIC);

            int perCol = (int) Math.ceil(n / (double) cols);
            for (int ci = 0; ci < cols; ci++) {
                int start = ci * perCol;
                if (start >= n) break;
                int end = Math.min(n, start + perCol);

                float x1 = left + ci * (colWidth + colGap);
                float x2 = x1 + colWidth;

                ColumnText col = new ColumnText(writer.getDirectContent());
                // Use dynamic top (itemsTopY) and keep well above totals band
                col.setSimpleColumn(x1, itemsBottomY, x2, itemsTopY);

                for (int i = start; i < end; i++) {
                    OrderItem it = items.get(i);

                    // Visible universal "checkbox": ASCII [ ]
                    Paragraph li = new Paragraph("[ ]  " + nvl(it.getQuantity()) + " × " + safe(it.getProductName()), fItem);
                    li.setSpacingAfter(2f);
                    col.addElement(li);

                    if (it.getOptionsText() != null && !it.getOptionsText().isBlank()) {
                        Paragraph vi = new Paragraph("Variants: " + it.getOptionsText(), fVar);
                        vi.setIndentationLeft(16f);
                        vi.setSpacingAfter(3f);
                        col.addElement(vi);
                    }
                }
                col.go();
            }

            // ───────────────── TOP FRAME 3: Totals band right above the line ─────────────────
            ColumnText totalsCt = new ColumnText(writer.getDirectContent());
            totalsCt.setSimpleColumn(left, yCut + 6f, right, yCut + totalsBandHeight);
            Paragraph totalsHdr = new Paragraph("TOTALS (INR)", new Font(Font.HELVETICA, 11, Font.BOLD));
            totalsHdr.setSpacingAfter(3f);
            Paragraph totalsP = new Paragraph(
                    "Items: " + inr(itemsSubtotal) + "  +  " +
                            "Shipping: " + inr(shipping) + "  -  " +
                            "Discount: " + inr(discount) + "  =  " +
                            "Total: " + inr(grand),
                    new Font(Font.HELVETICA, 10, Font.BOLD)
            );
            totalsCt.addElement(totalsHdr);
            totalsCt.addElement(totalsP);
            totalsCt.go();

            // ───────────────── BOTTOM FRAME: Addresses (wider L/R margins) ─────────────────
            float extraMargin = 56f;
            float innerLeft  = left  + extraMargin;
            float innerRight = right - extraMargin;
            float colGapBtm  = 18f;
            float colWidthB  = (innerRight - innerLeft - colGapBtm) / 2f;

            float bottomBlockTop = bottom + bottomZoneHeight; // absolute cap for bottom content

            // TO (left) — slightly higher
            ColumnText toCt = new ColumnText(writer.getDirectContent());
            toCt.setSimpleColumn(
                    innerLeft,
                    bottom,
                    innerLeft + colWidthB,
                    bottomBlockTop - 2f // never cross into the line gap
            );
            Paragraph toH = new Paragraph("TO:", new Font(Font.HELVETICA, 11, Font.BOLD));
            toH.setSpacingAfter(4f);
            toCt.addElement(toH);
            for (String ln : toBlock.split("\\r?\\n")) {
                if (!ln.isBlank()) {
                    Paragraph l = new Paragraph(ln, new Font(Font.HELVETICA, 10, Font.NORMAL));
                    toCt.addElement(l);
                }
            }
            if (!courier.isBlank()) {
                Paragraph c = new Paragraph("COURIER: " + courier, new Font(Font.HELVETICA, 10, Font.BOLD));
                c.setSpacingBefore(6f);
                toCt.addElement(c);
            }
            toCt.go();

            // FROM (right) — a bit lower/staggered vs TO
            ColumnText frCt = new ColumnText(writer.getDirectContent());
            frCt.setSimpleColumn(
                    innerLeft + colWidthB + colGapBtm,
                    bottom,
                    innerRight,
                    bottomBlockTop - 18f // visually lower than TO but still capped
            );
            Paragraph fromH = new Paragraph("FROM:", new Font(Font.HELVETICA, 11, Font.BOLD));
            fromH.setAlignment(Paragraph.ALIGN_RIGHT);
            fromH.setSpacingAfter(4f);
            frCt.addElement(fromH);
            for (String ln : fromAddress.split("\\r?\\n")) {
                if (!ln.isBlank()) {
                    Paragraph l = new Paragraph(ln, new Font(Font.HELVETICA, 10, Font.NORMAL));
                    l.setAlignment(Paragraph.ALIGN_RIGHT);
                    frCt.addElement(l);
                }
            }
            frCt.go();
        });
        log.info("[PRINT][PACKING_SLIP] Packing slip PDF generated for orderId={}, size={} bytes", orderId, pdf.length);
        return pdf;
    }
    /**
     * Generates a single PDF that contains packing slips for all given order IDs.
     * Each order renders on its own page using the same layout as renderPackingSlipPdf().
     */
    @Transactional(readOnly = true, propagation = Propagation.SUPPORTS, noRollbackFor = Exception.class)
    public byte[] renderPackingSlipsPdf(List<Long> orderIds) {
        if (orderIds == null || orderIds.isEmpty()) {
            throw new IllegalArgumentException("orderIds is required and must be non-empty");
        }
        log.info("[PRINT][PACKING_SLIP_BULK] Generating bulk packing slips for {} orderIds", orderIds.size());

        // Read settings once for all pages
        final String brandName = safe(setting("brand.name", "Blossom Buds Floral Artistry")).toUpperCase();
        final String fromAddress = safe(setting("brand.address",
                "Blossom Buds Floral Artistry\n12, Market Road\nChennai, TN 600001\nPhone: +91 9XXXXXXXXX"));

        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Document doc = new Document(PageSize.A4, 36, 36, 36, 36);
            PdfWriter writer = PdfWriter.getInstance(doc, out);
            doc.open();

            boolean first = true;
            List<Long> processed = new ArrayList<>();

            for (Long id : orderIds) {
                if (id == null) continue;

                // Try with geo; if not, fallback to lazy-safe
                Order order = orderRepository.findByIdWithShipGeo(id)
                        .orElseGet(() -> orderRepository.findById(id).orElse(null));
                if (order == null) {
                    log.warn("[PRINT][PACKING_SLIP_BULK] Skipping invalid orderId={}", id);
                    continue;
                }
                List<OrderItem> items = orderItemRepository.findByOrder_Id(id);
                log.debug("[PRINT][PACKING_SLIP_BULK] OrderId={} has {} items", id, items.size());

                if (!first) doc.newPage();
                first = false;

                // Render one full packing slip page
                writePackingSlipPage(doc, writer, order, items, brandName, fromAddress);

                processed.add(id);
            }

            if (processed.isEmpty()) {
                log.warn("[PRINT][PACKING_SLIP_BULK] No valid orders processed");
                throw new IllegalArgumentException("No valid orders to print.");
            }

            doc.close();
            byte[] pdf = out.toByteArray();
            log.info("[PRINT][PACKING_SLIP_BULK] Bulk packing slip PDF generated with {} orders, size={} bytes", processed.size(), pdf.length);
            return pdf;
        } catch (Exception e) {
            log.error("[PRINT][PACKING_SLIP_BULK] Failed to generate packing slips: {}", e.getMessage(), e);
            throw new IllegalStateException("Failed to generate bulk packing slips PDF", e);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // REFACTORED: Single-page writer used by both single & bulk methods
    // ─────────────────────────────────────────────────────────────────────────────
    private void writePackingSlipPage(
            Document doc, PdfWriter writer,
            Order order, List<OrderItem> items,
            String brandName, String fromAddress
    ) throws Exception {
        log.info("[PRINT][PACKING_SLIP_PAGE] Rendering packing slip page for orderId={}", order.getId());

        // Data strings (stay stringy to avoid LAZY trips)
        String orderCode     = safe(order.getPublicCode());
        String customerName  = safe(order.getShipName());
        String customerPhone = safe(order.getShipPhone());
        String notes         = safe(order.getOrderNotes());
        String courier       = safe(order.getCourierName());

        BigDecimal itemsSubtotal = nvl(order.getItemsSubtotal());
        BigDecimal shipping      = nvl(order.getShippingFee());
        BigDecimal grand         = nvl(order.getGrandTotal());
        BigDecimal discount      = nvl(order.getDiscountTotal());
        log.debug("[PRINT][PACKING_SLIP_PAGE] orderCode={}, itemsCount={}, customer={}",
                orderCode, items.size(), customerName);

        final String toBlock = joinLines(
                customerName + (order.getCustomerId() != null && !orderCode.isBlank() ? " (BB" + orderCode + ")" :
                        order.getCustomerId() != null ? " (" + order.getCustomerId() + ")" :
                                !orderCode.isBlank() ? " (BB" + orderCode + ")" : ""),
                safe(order.getShipLine1()),
                safe(order.getShipLine2()),
                mergeCityStatePin(
                        safeDistrictName(order),
                        safeStateName(order),
                        safe(order.getShipPincode())
                ),
                safeCountryName(order),
                (customerPhone.isBlank() ? "" : "Phone: " + customerPhone)
        );
        log.debug("[PRINT][PACKING_SLIP_PAGE] toBlockPrepared={}, courier={}", !toBlock.isBlank(), courier);

        // Page geometry
        Rectangle page = doc.getPageSize();
        float left   = doc.left();
        float right  = doc.right();
        float top    = doc.top();
        float bottom = doc.bottom();

        // Bottom address zone + cut line (same numbers as your single renderer)
        float bottomZoneHeight = 175f;
        float lineGap          = 10f;
        float yCut             = bottom + bottomZoneHeight + lineGap;
        log.debug("[PRINT][PACKING_SLIP_PAGE] Layout: left={}, right={}, top={}, bottom={}, yCut={}",
                left, right, top, bottom, yCut);

        // Set/replace page event for this page
        writer.setPageEvent(new CutFoldLineEvent(yCut));

        float guardTop = 12f;

        // ── TOP FRAME 1: Header, Meta, Notes, "ITEMS" ──
        ColumnText topCt = new ColumnText(writer.getDirectContent());
        topCt.setSimpleColumn(left, yCut + guardTop, right, top);

        topCt.addElement(brandHeader(brandName, /*uppercase*/ true, logoUrl(), logoMaxH()));


        PdfPTable hdr = new PdfPTable(new float[]{2.2f, 2f, 2.2f, 2.2f});
        hdr.setWidthPercentage(100);
        hdr.getDefaultCell().setBorder(Rectangle.NO_BORDER);
        hdr.addCell(noBorder(td("Order #: " + (orderCode.isBlank() ? order.getId() : orderCode))));
        hdr.addCell(noBorder(td("Date: " + fmtDate(order.getCreatedAt()))));
        hdr.addCell(noBorder(td("Customer: " + (customerName.isBlank() ? "—" : customerName))));
        hdr.addCell(noBorder(td("Phone: " + (customerPhone.isBlank() ? "—" : customerPhone))));
        topCt.addElement(hdr);

        if (!notes.isBlank()) {
            Paragraph p = new Paragraph("Order Notes: \"" + notes + "\"",
                    new Font(Font.HELVETICA, 10, Font.NORMAL));
            p.setSpacingBefore(8f);
            p.setSpacingAfter(8f);
            topCt.addElement(p);
        }

        Paragraph itemsHdr = new Paragraph("ITEMS", new Font(Font.HELVETICA, 11, Font.BOLD));
        itemsHdr.setSpacingBefore(6f);
        itemsHdr.setSpacingAfter(6f);
        topCt.addElement(itemsHdr);

        topCt.go();
        float itemsTopY = topCt.getYLine();
        if (itemsTopY <= 0 || Float.isNaN(itemsTopY)) itemsTopY = top - 90f;
        itemsTopY -= 6f;
        log.debug("[PRINT][PACKING_SLIP_PAGE] itemsTopY={}", itemsTopY);

        float totalsBandHeight = 64f;
        float itemsBottomY     = yCut + totalsBandHeight + 6f;

        // ── TOP FRAME 2: Items in dynamic columns ──
        int n = items.size();
        int cols = (n > 24) ? 3 : (n > 12 ? 2 : 1);
        log.debug("[PRINT][PACKING_SLIP_PAGE] items={}, cols={}", n, cols);

        float colGap = 12f;
        float colWidth = (right - left - (colGap * (cols - 1))) / cols;

        Font fItem = new Font(Font.HELVETICA, 11, Font.NORMAL);
        Font fVar  = new Font(Font.HELVETICA, 10, Font.ITALIC);

        int perCol = (int) Math.ceil(n / (double) cols);
        for (int ci = 0; ci < cols; ci++) {
            int start = ci * perCol;
            if (start >= n) break;
            int end = Math.min(n, start + perCol);

            float x1 = left + ci * (colWidth + colGap);
            float x2 = x1 + colWidth;

            ColumnText col = new ColumnText(writer.getDirectContent());
            col.setSimpleColumn(x1, itemsBottomY, x2, itemsTopY);

            for (int i = start; i < end; i++) {
                OrderItem it = items.get(i);

                // Create a small table for the item: [Image] [Text]
                PdfPTable itemTbl = new PdfPTable(new float[]{1f, 4f}); // 1 part image, 4 parts text
                itemTbl.setWidthPercentage(100);
                itemTbl.getDefaultCell().setBorder(Rectangle.NO_BORDER);
                itemTbl.getDefaultCell().setVerticalAlignment(Element.ALIGN_TOP);

                // 1. Image Cell
                PdfPCell imgCell = new PdfPCell();
                imgCell.setBorder(Rectangle.NO_BORDER);
                imgCell.setPaddingRight(4f);

                try {
                    if (it.getProductId() != null) {
                        ProductImage pImg = productImageRepository.findFirstByProduct_IdAndActiveTrueOrderBySortOrderAscIdAsc(it.getProductId()).orElse(null);
                        if (pImg != null) {
                            String imgUrl = pImg.getUrl();
                            if (imgUrl == null || imgUrl.isBlank()) {
                                imgUrl = pImg.getWatermarkVariantUrl();
                            }

                            if (imgUrl != null && !imgUrl.isBlank()) {
                                log.info("[PRINT][PACKING_SLIP] Loading image for item {} from: {}", it.getProductName(), imgUrl);
                                try {
                                    Image img = Image.getInstance(imgUrl);
                                    img.scaleToFit(32f, 32f); // Thumbnail size
                                    imgCell.addElement(img);
                                } catch (Exception e) {
                                    log.error("[PRINT][PACKING_SLIP] Failed to load image from URL: {}", imgUrl, e);
                                }
                            } else {
                                log.warn("[PRINT][PACKING_SLIP] Found image record but no URL for product {}", it.getProductName());
                            }
                        } else {
                            log.info("[PRINT][PACKING_SLIP] No active image found for product {}", it.getProductName());
                        }
                    }
                } catch (Exception e) {
                    log.error("[PRINT][PACKING_SLIP] Error fetching image for productId={}", it.getProductId(), e);
                }
                itemTbl.addCell(imgCell);

                // 2. Text Cell
                PdfPCell textCell = new PdfPCell();
                textCell.setBorder(Rectangle.NO_BORDER);
                
                Paragraph li = new Paragraph("[ ]  " + nvl(it.getQuantity()) + " × " + safe(it.getProductName()), fItem);
                li.setSpacingAfter(2f);
                textCell.addElement(li);

                if (it.getOptionsText() != null && !it.getOptionsText().isBlank()) {
                    Paragraph vi = new Paragraph("Variants: " + it.getOptionsText(), fVar);
                    vi.setIndentationLeft(0f); // Reset indentation as it's inside a cell
                    vi.setSpacingAfter(3f);
                    textCell.addElement(vi);
                }
                itemTbl.addCell(textCell);
                itemTbl.setKeepTogether(true);

                col.addElement(itemTbl);
                // Add a little spacing between items
                Paragraph spacer = new Paragraph("", new Font(Font.HELVETICA, 4, Font.NORMAL));
                col.addElement(spacer);
            }
            col.go();
        }

        // ── TOP FRAME 3: Totals band ──
        ColumnText totalsCt = new ColumnText(writer.getDirectContent());
        totalsCt.setSimpleColumn(left, yCut + 6f, right, yCut + totalsBandHeight);
        Paragraph totalsHdr = new Paragraph("TOTALS (INR)", new Font(Font.HELVETICA, 11, Font.BOLD));
        totalsHdr.setSpacingAfter(3f);
        Paragraph totalsP = new Paragraph(
                "Items: " + inr(itemsSubtotal) + "  +  " +
                        "Shipping: " + inr(shipping) + "  -  " +
                        "Discount: " + inr(discount) + "  =  " +
                        "Total: " + inr(grand),
                new Font(Font.HELVETICA, 10, Font.BOLD)
        );
        totalsCt.addElement(totalsHdr);
        totalsCt.addElement(totalsP);
        totalsCt.go();

        // ── BOTTOM FRAME: Addresses ──
        float extraMargin = 56f;
        float innerLeft  = left  + extraMargin;
        float innerRight = right - extraMargin;
        float colGapBtm  = 18f;
        float colWidthB  = (innerRight - innerLeft - colGapBtm) / 2f;

        float bottomBlockTop = bottom + 175f; // keep in sync with bottomZoneHeight

        // TO (left)
        ColumnText toCt = new ColumnText(writer.getDirectContent());
        toCt.setSimpleColumn(
                innerLeft,
                bottom,
                innerLeft + colWidthB,
                bottomBlockTop - 2f
        );
        Paragraph toH = new Paragraph("TO:", new Font(Font.HELVETICA, 11, Font.BOLD));
        toH.setSpacingAfter(4f);
        toCt.addElement(toH);
        for (String ln : toBlock.split("\\r?\\n")) {
            if (!ln.isBlank()) {
                Paragraph l = new Paragraph(ln, new Font(Font.HELVETICA, 10, Font.NORMAL));
                toCt.addElement(l);
            }
        }
        if (!courier.isBlank()) {
            Paragraph c = new Paragraph("COURIER: " + courier, new Font(Font.HELVETICA, 10, Font.BOLD));
            c.setSpacingBefore(6f);
            toCt.addElement(c);
        }
        toCt.go();

        // FROM (right)
        ColumnText frCt = new ColumnText(writer.getDirectContent());
        frCt.setSimpleColumn(
                innerLeft + colWidthB + colGapBtm,
                bottom,
                innerRight,
                bottomBlockTop - 18f
        );
        Paragraph fromH = new Paragraph("FROM:", new Font(Font.HELVETICA, 11, Font.BOLD));
        fromH.setAlignment(Paragraph.ALIGN_RIGHT);
        fromH.setSpacingAfter(4f);
        frCt.addElement(fromH);
        for (String ln : fromAddress.split("\\r?\\n")) {
            if (!ln.isBlank()) {
                Paragraph l = new Paragraph(ln, new Font(Font.HELVETICA, 10, Font.NORMAL));
                l.setAlignment(Paragraph.ALIGN_RIGHT);
                frCt.addElement(l);
            }
        }
        frCt.go();
        log.info("[PRINT][PACKING_SLIP_PAGE] Completed page render for orderId={}", order.getId());

    }



    // ---------------- helpers ----------------

    // === Brand header with optional logo (NEW) =========================
    /** Builds a logo + brand header. Falls back to text-only if logo is unavailable. */
    /** Builds a super-compact logo + brand header row (no extra gap). */
    /** Compact left-aligned logo + brand name in one line (no extra gaps). */
    /** Compact left-aligned logo + brand name with visual centers aligned. */
    private Element brandHeader(String brandName, boolean uppercase, String logoUrlSetting, float maxLogoH) {
        try {
            log.info("[PRINT][LOGO] Attempting to load logo from setting: {}", logoUrlSetting);
            Image logo = tryLoadLogoImage(logoUrlSetting); // your existing loader; returns null if not found
            if (logo != null) {
                final float maxH = (maxLogoH > 0 ? maxLogoH : 28f);
                log.info("[PRINT][LOGO] Logo loaded successfully");

                // Scale logo to target max height, keep aspect ratio
                logo.scaleToFit(1000f, maxH); // huge width cap, strict height cap
                final float imgH = logo.getScaledHeight();

                // Title font
                String text = uppercase ? safe(brandName).toUpperCase() : safe(brandName);
                Font f = new Font(Font.HELVETICA, 16, Font.BOLD);
                final float fontPx = f.getSize(); // close to text box height for this purpose

                // Compute vertical offset so image center ≈ text center
                // Positive y lifts image up; negative y pushes it down.
                // We subtract a tiny tweak to counter baseline optical bias.
                final float fineTweak = -0.5f; // adjust between [-1.5, +1.5] if needed
                final float yOffset = (fontPx - imgH) / 2f + fineTweak;

                Paragraph p = new Paragraph();
                p.setAlignment(Element.ALIGN_LEFT);
                p.setSpacingBefore(0f);
                p.setSpacingAfter(8f);
                p.setLeading(0f, 1.1f);

                // Inline: logo, thin spacer, text
                p.add(new Chunk(logo, 0f, yOffset, true));
                p.add(new Chunk(" ", f)); // tiny gap
                p.add(new Chunk(text, f));

                return p;
            }
        } catch (Exception e) {
            log.warn("[PRINT][LOGO] Exception while loading logo image from setting '{}': {}", logoUrlSetting, e.getMessage());
        }

        // Fallback: text-only, left aligned
        String text = uppercase ? safe(brandName).toUpperCase() : safe(brandName);
        log.info("[PRINT][LOGO] Falling back to text-only brand header: {}", text);
        Paragraph p = new Paragraph(text, new Font(Font.HELVETICA, 16, Font.BOLD));
        p.setAlignment(Element.ALIGN_LEFT);
        p.setSpacingAfter(8f);
        return p;
    }



    /**
     * Tries to load a logo image in this priority:
     *  1) brand.logo_url (if provided)
     *  2) @Value logoPngPath as classpath resource (e.g., static/BB_logo.png)
     *  3) @Value logoPngPath as filesystem path
     * Returns null if nothing works.
     */
    private Image tryLoadLogoImage(String logoUrlSetting) {
        // 1) If settings provided a direct URL/path, try it first
        try {
            if (logoUrlSetting != null && !logoUrlSetting.isBlank()) {
                log.info("[PRINT][LOGO] Trying direct logo URL/path: {}", logoUrlSetting);
                return Image.getInstance(logoUrlSetting);
            }
        } catch (Exception e) {
            log.warn("[PRINT][LOGO] Failed to load image from direct path: {}", e.getMessage());
        }

        // 2) Try classpath resource for PNG path (e.g., "static/BB_logo.png")
        //    Works when the file is under src/main/resources/static/...
        for (String cp : new String[] { logoPngPath, (logoPngPath != null && !logoPngPath.startsWith("/")) ? ("/" + logoPngPath) : null }) {
            if (cp == null || cp.isBlank()) continue;
            try (java.io.InputStream in = getClass().getResourceAsStream(cp)) {
                if (in != null) {
                    log.info("[PRINT][LOGO] Loading logo from classpath resource: {}", cp);
                    byte[] bytes = in.readAllBytes();
                    return Image.getInstance(bytes);
                }
            } catch (Exception e) {
                log.warn("[PRINT][LOGO] Failed to load logo from classpath {}: {}", cp, e.getMessage());
            }
            try (java.io.InputStream in = Thread.currentThread().getContextClassLoader().getResourceAsStream(cp.startsWith("/") ? cp.substring(1) : cp)) {
                if (in != null) {
                    log.info("[PRINT][LOGO] Loading logo from context classpath: {}", cp);
                    byte[] bytes = in.readAllBytes();
                    return Image.getInstance(bytes);
                }
            }  catch (Exception e) {
                log.warn("[PRINT][LOGO] Failed to load logo from context classpath {}: {}", cp, e.getMessage());
            }
        }

        // 3) Try filesystem path as a fallback
        try {
            if (logoPngPath != null && !logoPngPath.isBlank()) {
                java.io.File f = new java.io.File(logoPngPath);
                if (f.exists() && f.isFile()) {
                    log.info("[PRINT][LOGO] Loading logo from filesystem path: {}", f.getAbsolutePath());
                    return Image.getInstance(f.getAbsolutePath());
                }
            }
        } catch (Exception e) {
            log.warn("[PRINT][LOGO] Failed to load logo from filesystem: {}", e.getMessage());
        }

        // NOTE: SVG not supported natively by OpenPDF; keep PNG as the reliable source.
        log.info("[PRINT][LOGO] No logo found — returning null");
        return null;
    }
    /** Reads logo URL and max height from settings. */
    private String logoUrl() {
        String logoUrl = safe(setting("brand.logo_url", ""));
        log.debug("[PRINT][LOGO] Resolved logo URL: {}", logoUrl);
        return logoUrl;
    }

    /** Max logo height in points (PDF units). Optional (defaults to ~10mm). */
    private float logoMaxH() {
        try {
            String v = setting("brand.logo_max_h", "28");
            float parsed = Float.parseFloat(v);
            log.debug("[PRINT][LOGO] Parsed logo max height: {}", parsed);
            return parsed;
        } catch (Exception e) {
            log.warn("[PRINT][LOGO] Failed to parse logo max height — using default 28");
            return 28f;
        }
    }


    /** Minimal functional interface to write into a PDF document. */
    private interface PdfWriterFn { void accept(Document doc) throws Exception; }

    /** Variant that also exposes the PdfWriter (for page events, etc.). */
    private interface PdfWriterFn2 { void accept(Document doc, PdfWriter writer) throws Exception; }

    /** Builds a PDF with common margins and returns bytes. */
    private byte[] buildPdf(PdfWriterFn fn) {
        log.info("[PRINT][PDF] Starting to build single-page PDF...");
        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Document doc = new Document(PageSize.A4, 36, 36, 36, 36);
            PdfWriter.getInstance(doc, out);
            doc.open();
            fn.accept(doc);
            doc.close();
            log.info("[PRINT][PDF] PDF generated successfully ({} bytes)", out.size());
            return out.toByteArray();
        } catch (Exception e) {
            log.error("[PRINT][PDF] Failed to generate PDF: {}", e.getMessage());
            throw new IllegalStateException("Failed to generate PDF", e);
        }
    }

    /** Builds a PDF (exposes writer) with common margins and returns bytes. */
    private byte[] buildPdfWithWriter(PdfWriterFn2 fn) {
        log.info("[PRINT][PDF] Starting to build multi-page PDF with writer...");
        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Document doc = new Document(PageSize.A4, 36, 36, 36, 36);
            PdfWriter writer = PdfWriter.getInstance(doc, out);
            doc.open();
            fn.accept(doc, writer);
            doc.close();
            log.info("[PRINT][PDF] Multi-page PDF generated successfully ({} bytes)", out.size());
            return out.toByteArray();
        } catch (Exception e) {
            log.error("[PRINT][PDF] Failed to generate multi-page PDF: {}", e.getMessage());
            throw new IllegalStateException("Failed to generate PDF", e);
        }
    }

    /** Page event: dashed CUT / FOLD LINE at a fixed Y position. */
    private static class CutFoldLineEvent extends PdfPageEventHelper {
        private final float yCut;
        CutFoldLineEvent(float yCut) { this.yCut = yCut;
            log.debug("[PRINT][PDF] CutFoldLineEvent initialized at Y = {}", yCut);}

        @Override
        public void onEndPage(PdfWriter writer, Document document) {
            PdfContentByte cb = writer.getDirectContent();
            cb.saveState();
            cb.setLineWidth(0.8f);
            cb.setLineDash(4f, 4f);

            float left  = document.left();
            float right = document.right();

            cb.moveTo(left, yCut);
            cb.lineTo(right, yCut);
            cb.stroke();

            try {
                BaseFont bf = BaseFont.createFont(BaseFont.HELVETICA_BOLD, BaseFont.WINANSI, false);
                String label = "CUT / FOLD LINE";
                float tw = bf.getWidthPoint(label, 8);
                float x = (left + right - tw) / 2f;
                cb.beginText();
                cb.setFontAndSize(bf, 8);
                cb.setTextMatrix(x, yCut + 3f);
                cb.showText(label);
                cb.endText();
            } catch (Exception e) {
                log.warn("[PRINT][PDF] Failed to render cut/fold line: {}", e.getMessage());
            }
            cb.restoreState();
        }
    }

    /** Renders a section title. */
    private Paragraph title(String s) {
        Font f = new Font(Font.HELVETICA, 16, Font.BOLD);
        Paragraph p = new Paragraph(s, f);
        p.setSpacingAfter(10f);
        return p;
    }

    /** Adds a medium vertical spacer. */
    private Paragraph spacer() {
        Paragraph p = new Paragraph(" ");
        p.setSpacingAfter(10f);
        return p;
    }

    /** Adds a small vertical spacer. */
    private Paragraph spacerSmall() {
        Paragraph p = new Paragraph(" ");
        p.setSpacingAfter(6f);
        return p;
    }

    /** Renders the order items table with pricing (invoice). */
    private PdfPTable itemsTable(List<OrderItem> items) {
        log.info("[PRINT][ITEMS] Building items table with {} entries", items != null ? items.size() : 0);

        PdfPTable t = new PdfPTable(new float[]{5f, 1.2f, 1.6f, 1.6f});
        t.setWidthPercentage(100);
        t.addCell(th("Item"));
        t.addCell(th("Qty"));
        t.addCell(th("Unit"));
        t.addCell(th("Line Total"));
        for (OrderItem it : items) {
            t.addCell(td(safe(it.getProductName()) + optionsBlock(it)));
            t.addCell(td(String.valueOf(nvl(it.getQuantity()))));
            t.addCell(td(nvl(it.getUnitPrice()).toPlainString()));
            t.addCell(td(nvl(it.getLineTotal()).toPlainString()));
        }
        log.debug("[PRINT][ITEMS] Added item rows {}", items.size());

        return t;
    }

    /** Appends option text block for an item if present. */
    private String optionsBlock(OrderItem it) {
        StringBuilder sb = new StringBuilder();
        if (it.getOptionsText() != null && !it.getOptionsText().isBlank()) {
            sb.append("\n").append(it.getOptionsText());
        }
        return sb.toString();
    }

    /** Header cell style. */
    private PdfPCell th(String s) {
        Font f = new Font(Font.HELVETICA, 10, Font.BOLD);
        PdfPCell c = new PdfPCell(new Phrase(s, f));
        c.setPadding(6f);
        return c;
    }

    /** Body cell style. */
    private PdfPCell td(String s) {
        Font f = new Font(Font.HELVETICA, 10, Font.NORMAL);
        PdfPCell c = new PdfPCell(new Phrase(s, f));
        c.setPadding(6f);
        return c;
    }

    /** Two-column key/value cell (normal). */
    private PdfPCell kvCell(String k, String v) {
        PdfPTable inner = new PdfPTable(new float[]{3f, 2f});
        inner.setWidthPercentage(100);
        inner.addCell(noBorder(td(k)));
        inner.addCell(noBorder(td(v)));
        PdfPCell wrap = new PdfPCell(inner);
        wrap.setPadding(0);
        return wrap;
    }

    /** Two-column key/value cell (bold, optional shaded). */
    private PdfPCell kvCellBold(String k, String v, boolean shaded) {
        Font f = new Font(Font.HELVETICA, 11, Font.BOLD);
        PdfPTable inner = new PdfPTable(new float[]{3f, 2f});
        inner.setWidthPercentage(100);
        PdfPCell l = new PdfPCell(new Phrase(k, f));
        l.setPadding(6f);
        l.setBorder(Rectangle.NO_BORDER);
        PdfPCell r = new PdfPCell(new Phrase(v, f));
        r.setPadding(6f);
        r.setBorder(Rectangle.NO_BORDER);
        inner.addCell(l);
        inner.addCell(r);
        PdfPCell wrap = new PdfPCell(inner);
        if (shaded) wrap.setGrayFill(0.95f);
        wrap.setPadding(0);
        return wrap;
    }

    /** Removes border from a cell. */
    private PdfPCell noBorder(PdfPCell c) {
        c.setBorder(Rectangle.NO_BORDER);
        return c;
    }

    /** Ensures order code is displayed with BB prefix. */
    private String displayPublicCode(String yyNNNN) {
        if (yyNNNN == null || yyNNNN.isBlank()) return "";
        return yyNNNN.startsWith("BB") ? yyNNNN : "BB" + yyNNNN;
    }

    /** Formats LocalDateTime (invoice detailed). */
    private String fmt(LocalDateTime ts) {
        if (ts == null) return "";
        return ts.format(DateTimeFormatter.ofPattern("dd-MMM-uuuu HH:mm"));
    }

    /** Short date (e.g., "16 Oct 2025"). */
    private String fmtDate(LocalDateTime ts) {
        if (ts == null) return "";
        return ts.format(DateTimeFormatter.ofPattern("d MMM uuuu"));
    }

    /** INR formatting. */
    private String inr(BigDecimal v) {
        BigDecimal x = nvl(v);
        return "₹ " + x.setScale(2, java.math.RoundingMode.HALF_UP).toPlainString();
    }

    /** Null-safe string. */
    private String safe(String s) {
        return s == null ? "" : s;
    }

    /** Joins non-blank lines with newlines. */
    private String joinLines(String... lines) {
        StringBuilder sb = new StringBuilder();
        for (String l : lines) {
            if (l != null && !l.isBlank()) {
                if (sb.length() != 0) sb.append("\n");
                sb.append(l);
            }
        }
        return sb.toString();
    }

    /** Build "District, State PIN" line. */
    private String mergeCityStatePin(String district, String state, String pincode) {
        String left = "";
        if (!district.isBlank()) left = district;
        if (!state.isBlank()) left = left.isBlank() ? state : left + ", " + state;
        if (!pincode.isBlank()) left = left + " " + pincode;
        return left;
    }

    /** Safely read district name without triggering LazyInitializationException. */
    private String safeDistrictName(Order o) {
        try { if (hasText(o.getShipDistrict().getName())) return o.getShipDistrict().getName(); }
        catch (Throwable ignore) {}
        try { return (o.getShipDistrict() != null) ? safe(o.getShipDistrict().getName()) : ""; }
        catch (LazyInitializationException ex) { return ""; }
    }

    /** Safely read state name without triggering LazyInitializationException. */
    private String safeStateName(Order o) {
        try { if (hasText(o.getShipState().getName())) return o.getShipState().getName(); }
        catch (Throwable ignore) {}
        try { return (o.getShipState() != null) ? safe(o.getShipState().getName()) : ""; }
        catch (LazyInitializationException ex) { return ""; }
    }

    /** Safely read country name without triggering LazyInitializationException. */
    private String safeCountryName(Order o) {
        try { if (hasText(o.getShipCountry().getName())) return o.getShipCountry().getName(); }
        catch (Throwable ignore) {}
        try { return (o.getShipCountry() != null) ? safe(o.getShipCountry().getName()) : ""; }
        catch (LazyInitializationException ex) { return ""; }
    }

    private boolean hasText(String s) { return s != null && !s.isBlank(); }

    /** Null-coalescing BigDecimal -> zero. */
    private BigDecimal nvl(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }

    /** Null-coalescing Integer -> zero. */
    private Integer nvl(Integer v) {
        return v == null ? 0 : v;
    }

    /** Reads a setting value or returns default when missing. */
    private String setting(String key, String defVal) {
        try {
            Setting s = settingsService.get(key);
            return s.getValue() != null ? s.getValue() : defVal;
        } catch (Exception ignore) {
            return defVal;
        }
    }
}
