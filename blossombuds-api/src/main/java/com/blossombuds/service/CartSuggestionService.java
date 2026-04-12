package com.blossombuds.service;

import com.blossombuds.domain.CartSuggestionProduct;
import com.blossombuds.domain.Product;
import com.blossombuds.dto.CartSuggestionProductDto;
import com.blossombuds.dto.CartSuggestionReorderDto;
import com.blossombuds.repository.CartSuggestionProductRepository;
import com.blossombuds.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CartSuggestionService {

    private final CartSuggestionProductRepository repo;
    private final ProductRepository productRepository;

    public List<Product> listCustomerSuggestions() {
        List<CartSuggestionProduct> links = repo.findByActiveTrueOrderBySortOrderAscIdAsc();

        List<Long> ids = links.stream()
                .map(CartSuggestionProduct::getProductId)
                .toList();

        if (ids.isEmpty()) return List.of();

        Map<Long, Product> map = productRepository.findAllById(ids).stream()
                .filter(p -> Boolean.TRUE.equals(p.getActive()))
                .filter(p -> Boolean.TRUE.equals(p.getVisible()))
                .filter(p -> !Boolean.FALSE.equals(p.getInStock()))
                .collect(Collectors.toMap(Product::getId, p -> p));

        List<Product> ordered = new ArrayList<>();
        for (Long id : ids) {
            Product p = map.get(id);
            if (p != null) ordered.add(p);
        }
        return ordered;
    }

    public List<CartSuggestionProductDto> listAdminSuggestions() {
        List<CartSuggestionProduct> rows = repo.findByActiveTrueOrderBySortOrderAscIdAsc();

        List<Long> productIds = rows.stream()
                .map(CartSuggestionProduct::getProductId)
                .toList();

        Map<Long, Product> productMap = productRepository.findAllById(productIds).stream()
                .collect(Collectors.toMap(Product::getId, p -> p));

        return rows.stream()
                .map(row -> {
                    CartSuggestionProductDto dto = new CartSuggestionProductDto();
                    dto.setId(row.getId());
                    dto.setProductId(row.getProductId());
                    dto.setSortOrder(row.getSortOrder());
                    dto.setActive(row.getActive());

                    Product p = productMap.get(row.getProductId());
                    dto.setProductName(p != null ? p.getName() : null);

                    return dto;
                })
                .toList();
    }

    @Transactional
    public CartSuggestionProduct addProduct(Long productId) {
        repo.findByProductId(productId).ifPresent(existing -> {
            throw new IllegalArgumentException("Product already in cart suggestions");
        });

        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new IllegalArgumentException("Product not found: " + productId));

        CartSuggestionProduct row = new CartSuggestionProduct();
        row.setProductId(product.getId());
        row.setSortOrder((int) repo.count());
        row.setActive(Boolean.TRUE);
        return repo.save(row);
    }

    @Transactional
    public CartSuggestionProductDto addSuggestionAndReturnDto(Long productId) {
        CartSuggestionProduct row = addProduct(productId);

        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new IllegalArgumentException("Product not found: " + productId));

        CartSuggestionProductDto dto = new CartSuggestionProductDto();
        dto.setId(row.getId());
        dto.setProductId(row.getProductId());
        dto.setProductName(product.getName());
        dto.setSortOrder(row.getSortOrder());
        dto.setActive(row.getActive());
        return dto;
    }

    @Transactional
    public void removeProduct(Long productId) {
        CartSuggestionProduct row = repo.findByProductId(productId)
                .orElseThrow(() -> new IllegalArgumentException("Suggestion product not found"));
        repo.delete(row);
    }
    @Transactional
    public void reorder(List<CartSuggestionReorderDto> items) {
        if (items == null || items.isEmpty()) {
            throw new IllegalArgumentException("Reorder payload is required");
        }

        Map<Long, Integer> orderMap = items.stream()
                .filter(x -> x.getProductId() != null && x.getSortOrder() != null)
                .collect(Collectors.toMap(
                        CartSuggestionReorderDto::getProductId,
                        CartSuggestionReorderDto::getSortOrder
                ));

        List<CartSuggestionProduct> rows = repo.findAllByProductIdIn(orderMap.keySet());

        for (CartSuggestionProduct row : rows) {
            Integer sortOrder = orderMap.get(row.getProductId());
            if (sortOrder != null) {
                row.setSortOrder(sortOrder);
            }
        }
    }
}