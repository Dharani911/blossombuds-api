package com.blossombuds.service;

import com.blossombuds.domain.BackInStockRequest;
import com.blossombuds.domain.Customer;
import com.blossombuds.domain.Product;
import com.blossombuds.dto.BackInStockResponseDto;
import com.blossombuds.repository.BackInStockRequestRepository;
import com.blossombuds.repository.CustomerRepository;
import com.blossombuds.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.validation.annotation.Validated;

import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Service
@Validated
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class BackInStockService {

    private final BackInStockRequestRepository requestRepo;
    private final ProductRepository productRepo;
    private final CustomerRepository customerRepo;
    private final EmailService emailService;

    @Transactional
    public BackInStockResponseDto subscribe(Long productId, String email, Long customerId) {
        if (productId == null) {
            throw new IllegalArgumentException("productId is required");
        }

        Product product = productRepo.findById(productId)
                .orElseThrow(() -> new IllegalArgumentException("Product not found: " + productId));

        if (Boolean.TRUE.equals(product.getInStock())) {
            return new BackInStockResponseDto(false, "This product is already in stock.");
        }

        Customer customer = null;
        String resolvedEmail = email;

        if (customerId != null) {
            customer = customerRepo.findById(customerId)
                    .orElseThrow(() -> new IllegalArgumentException("Customer not found: " + customerId));

            if (customer.getEmail() == null || customer.getEmail().isBlank()) {
                throw new IllegalArgumentException("Logged-in account does not have a valid email address.");
            }
            resolvedEmail = customer.getEmail().trim();
        }

        if (resolvedEmail == null || resolvedEmail.isBlank()) {
            throw new IllegalArgumentException("Email is required.");
        }

        resolvedEmail = resolvedEmail.trim().toLowerCase();

        boolean exists;
        if (customer != null) {
            exists = requestRepo.existsByProduct_IdAndCustomer_IdAndActiveTrueAndNotifiedFalse(productId, customer.getId());
        } else {
            exists = requestRepo.existsByProduct_IdAndEmailIgnoreCaseAndActiveTrueAndNotifiedFalse(productId, resolvedEmail);
        }

        if (exists) {
            return new BackInStockResponseDto(true, "You are already on the notification list for this product.");
        }

        BackInStockRequest req = new BackInStockRequest();
        req.setProduct(product);
        req.setCustomer(customer);
        req.setEmail(resolvedEmail);
        req.setActive(Boolean.TRUE);
        req.setNotified(Boolean.FALSE);

        requestRepo.save(req);

        log.info("[BACK_IN_STOCK][SUBSCRIBE][OK] productId={} customerId={} email={}",
                productId, customer != null ? customer.getId() : null, resolvedEmail);

        return new BackInStockResponseDto(true, "We’ll email you when this product is back in stock.");
    }

    @Transactional
    public void notifySubscribersIfBackInStock(Product product, boolean wasInStockBeforeUpdate) {
        if (product == null || product.getId() == null) return;

        boolean wasOutOfStock = !wasInStockBeforeUpdate;
        boolean nowInStock = Boolean.TRUE.equals(product.getInStock());

        if (!(wasOutOfStock && nowInStock)) {
            return;
        }

        List<BackInStockRequest> pending = requestRepo.findByProduct_IdAndActiveTrueAndNotifiedFalse(product.getId());
        if (pending.isEmpty()) {
            log.info("[BACK_IN_STOCK][NOTIFY] no pending requests for productId={}", product.getId());
            return;
        }
        String productUrl = "/products/" + product.getId();
        if (product.getSlug() != null && !product.getSlug().isBlank()) {
            productUrl = "/products/" + product.getSlug();
        }
        for (BackInStockRequest req : pending) {
            try {
                emailService.sendRichMasked(
                        req.getEmail(),
                        "Back in stock: " + product.getName(),
                        """
                        Hi there,
                
                        Good news — a product you asked about is now back in stock.
                
                        Product: %s
                
                        You can explore it here:
                        {{A|View product|%s}}
                
                        Please do not reply to this email.
                
                        Warm regards,
                        Blossom Buds Floral Artistry
                        """.formatted(product.getName(), productUrl)
                );

                req.setNotified(Boolean.TRUE);
                req.setActive(Boolean.FALSE);
                req.setNotifiedAt(LocalDateTime.now());

                log.info("[BACK_IN_STOCK][NOTIFY][OK] productId={} email={}", product.getId(), req.getEmail());
            } catch (Exception ex) {
                log.error("[BACK_IN_STOCK][NOTIFY][FAIL] productId={} email={}",
                        product.getId(), req.getEmail(), ex);
            }
        }
    }
}