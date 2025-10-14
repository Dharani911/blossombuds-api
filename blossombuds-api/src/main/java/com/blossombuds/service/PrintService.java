package com.blossombuds.service;

import com.blossombuds.domain.Order;
import com.blossombuds.domain.OrderItem;
import com.blossombuds.domain.Setting;
import com.blossombuds.repository.OrderItemRepository;
import com.blossombuds.repository.OrderRepository;
import com.lowagie.text.Document;
import com.lowagie.text.Font;
import com.lowagie.text.PageSize;
import com.lowagie.text.Paragraph;
import com.lowagie.text.Phrase;
import com.lowagie.text.Rectangle;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

/** PDF generator for invoices & packing slips using OpenPDF (minimal, template-friendly). */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class PrintService {

    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final SettingsService settingsService;

    /** Generates invoice PDF bytes for a given order id. */
    @Transactional(readOnly = true)
    public byte[] renderInvoicePdf(Long orderId) {
        if (orderId == null) throw new IllegalArgumentException("orderId is required");

        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Order not found: " + orderId));
        List<OrderItem> items = orderItemRepository.findByOrder_Id(orderId);

        String brandName = safe(setting("brand.name", "Blossom & Buds"));
        String fromAddress = safe(setting("invoice.from_address", "Chennai, TN"));
        String supportEmail = safe(setting("brand.support_email", "support@example.com"));
        String supportPhone = safe(setting("brand.support_phone", "+91-00000-00000"));

        return buildPdf(doc -> {
            // Header
            doc.add(title(brandName + " — Tax Invoice"));
            doc.add(new Paragraph("Order: " + displayPublicCode(order.getPublicCode())));
            doc.add(new Paragraph("Placed: " + fmt(order.getCreatedAt())));
            doc.add(new Paragraph("Invoice To: " + safe(order.getShipName())));
            doc.add(new Paragraph(joinLines(
                    safe(order.getShipLine1()),
                    safe(order.getShipLine2()),
                    safe(order.getShipDistrict() != null ? order.getShipDistrict().getName() : null)
                            + (order.getShipState() != null ? ", " + safe(order.getShipState().getName()) : "")
                            + (order.getShipPincode() != null ? " " + safe(order.getShipPincode()) : ""),
                    safe(order.getShipCountry() != null ? order.getShipCountry().getName() : null)
            )));
            doc.add(spacer());

            // Items table
            doc.add(itemsTable(items));

            // Totals
            doc.add(spacerSmall());
            BigDecimal subtotal = nvl(order.getItemsSubtotal());
            BigDecimal shipping = nvl(order.getShippingFee());
            BigDecimal discount = nvl(order.getDiscountTotal());
            BigDecimal grand = nvl(order.getGrandTotal());

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
    }

    /** Generates packing slip PDF bytes for a given order id (no pricing). */
    @Transactional(readOnly = true)
    public byte[] renderPackingSlipPdf(Long orderId) {
        if (orderId == null) throw new IllegalArgumentException("orderId is required");

        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Order not found: " + orderId));
        List<OrderItem> items = orderItemRepository.findByOrder_Id(orderId);

        String brandName = safe(setting("brand.name", "Blossom & Buds"));

        return buildPdf(doc -> {
            // Header
            doc.add(title(brandName + " — Packing Slip"));
            doc.add(new Paragraph("Order: " + displayPublicCode(order.getPublicCode())));
            doc.add(new Paragraph("Packed Date: " + fmt(order.getModifiedAt())));
            doc.add(spacer());

            // Ship To
            doc.add(new Paragraph("Ship To: " + safe(order.getShipName())));
            doc.add(new Paragraph(joinLines(
                    safe(order.getShipLine1()),
                    safe(order.getShipLine2()),
                    safe(order.getShipDistrict() != null ? order.getShipDistrict().getName() : null)
                            + (order.getShipState() != null ? ", " + safe(order.getShipState().getName()) : "")
                            + (order.getShipPincode() != null ? " " + safe(order.getShipPincode()) : ""),
                    safe(order.getShipCountry() != null ? order.getShipCountry().getName() : null),
                    "Phone: " + safe(order.getShipPhone())
            )));
            doc.add(spacer());

            // Items (no pricing)
            PdfPTable t = new PdfPTable(new float[]{7f, 1.5f});
            t.setWidthPercentage(100);
            t.addCell(th("Item"));
            t.addCell(th("Qty"));
            for (OrderItem it : items) {
                t.addCell(td(safe(it.getProductName()) + optionsBlock(it)));
                t.addCell(td(String.valueOf(nvl(it.getQuantity()))));
            }
            doc.add(t);

            doc.add(spacer());
            if (order.getOrderNotes() != null && !order.getOrderNotes().isBlank()) {
                doc.add(new Paragraph("Notes: " + order.getOrderNotes()));
            }
        });
    }

    // ---------------- helpers ----------------

    /** Minimal functional interface to write into a PDF document. */
    private interface PdfWriterFn { void accept(Document doc) throws Exception; }

    /** Builds a PDF with common margins and returns bytes. */
    private byte[] buildPdf(PdfWriterFn fn) {
        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Document doc = new Document(PageSize.A4, 36, 36, 36, 36);
            PdfWriter.getInstance(doc, out);
            doc.open();
            fn.accept(doc);
            doc.close();
            return out.toByteArray();
        } catch (Exception e) {
            throw new IllegalStateException("Failed to generate PDF", e);
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

    /** Renders the order items table with pricing. */
    private PdfPTable itemsTable(List<OrderItem> items) {
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

    /** Formats an OffsetDateTime or returns empty string. */
    private String fmt(OffsetDateTime ts) {
        if (ts == null) return "";
        return ts.format(DateTimeFormatter.ofPattern("dd-MMM-uuuu HH:mm"));
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
