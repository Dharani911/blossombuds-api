package com.blossombuds.web;

import com.blossombuds.domain.Order;
import com.blossombuds.service.PrintService;
import com.blossombuds.repository.OrderRepository;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

/** Print endpoints: invoice & packing slip PDFs. */
@RestController
@RequestMapping("/api/print")
@RequiredArgsConstructor
@Validated
public class PrintController {

    private final PrintService printService;
    private final OrderRepository orderRepo;

    /** Generate invoice PDF for an order (admin, or the customer who owns the order). */
    @GetMapping("/orders/{orderId}/invoice")
    @PreAuthorize("hasAnyRole('ADMIN','CUSTOMER')")
    public ResponseEntity<byte[]> invoice(@PathVariable @Min(1) Long orderId, Authentication auth) {
        ensureOwnershipOrAdmin(orderId, auth);
        byte[] pdf = printService.renderInvoicePdf(orderId);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=invoice-" + orderId + ".pdf")
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdf);
    }

    /** Generate packing slip PDF for an order (admin, or the customer who owns the order). */
    @GetMapping("/orders/{orderId}/packing-slip")
    @PreAuthorize("hasAnyRole('ADMIN','CUSTOMER')")
    public ResponseEntity<byte[]> packingSlip(@PathVariable @Min(1) Long orderId, Authentication auth) {
        ensureOwnershipOrAdmin(orderId, auth);
        byte[] pdf = printService.renderPackingSlipPdf(orderId);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=packing-" + orderId + ".pdf")
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdf);
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    /** Admin can access any order; CUSTOMER can access only their own (principal "cust:{id}"). */
    private void ensureOwnershipOrAdmin(Long orderId, Authentication auth) {
        if (auth == null) throw new IllegalArgumentException("Unauthorized");

        boolean isAdmin = auth.getAuthorities().stream()
                .anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()));
        if (isAdmin) return;

        boolean isCustomer = auth.getAuthorities().stream()
                .anyMatch(a -> "ROLE_CUSTOMER".equals(a.getAuthority()));
        if (!isCustomer) throw new IllegalArgumentException("Forbidden");

        Long authCustomerId = parseCustomerId(auth.getName());
        Order order = orderRepo.findById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Order not found: " + orderId));
        if (authCustomerId == null || !authCustomerId.equals(order.getCustomerId())) {
            throw new IllegalArgumentException("You can only access your own order documents");
        }
    }

    private Long parseCustomerId(String principal) {
        try {
            if (principal != null && principal.startsWith("cust:")) {
                return Long.parseLong(principal.substring("cust:".length()));
            }
        } catch (Exception ignored) {}
        return null;
    }
}
