package com.blossombuds.web;

import com.blossombuds.domain.DeliveryPartner;
import com.blossombuds.dto.DeliveryPartnerDto;
import com.blossombuds.service.DeliveryPartnerService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** HTTP endpoints for managing delivery/courier partners. */
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/partners")
@Validated
public class DeliveryPartnerController {

    private final DeliveryPartnerService partners;

    /** Create a partner (admin). */
    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    @ResponseStatus(HttpStatus.CREATED)
    public DeliveryPartner create(@Valid @RequestBody DeliveryPartnerDto dto, Authentication auth) {
        return partners.create(dto, actor(auth));
    }

    /** Update partner fields (admin). */
    @PatchMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public DeliveryPartner update(@PathVariable @Min(1) Long id,
                                  @Valid @RequestBody DeliveryPartnerDto dto,
                                  Authentication auth) {
        return partners.update(id, dto, actor(auth));
    }

    /** Get by id (admin). */
    @GetMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public DeliveryPartner get(@PathVariable @Min(1) Long id) {
        return partners.get(id);
    }

    /** Get by code (public). */
    @GetMapping("/by-code/{code}")
    public DeliveryPartner getByCode(@PathVariable String code) {
        return partners.getByCode(code)
                .orElseThrow(() -> new IllegalArgumentException("DeliveryPartner not found: " + code));
    }

    /** Back-compat: slug alias to code (public). */
    @GetMapping("/by-slug/{slug}")
    public DeliveryPartner getBySlugCompat(@PathVariable String slug) {
        // Treat slug path param as "code" to support older clients
        return getByCode(slug);
    }

    /** List all partners (admin). */
    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public List<DeliveryPartner> listAll() {
        return partners.listAll();
    }

    /** List only active partners (public). */
    @GetMapping("/active")
    public List<DeliveryPartner> listActive() {
        return partners.listActive();
    }

    /** Toggle active flag (admin). */
    @PostMapping("/{id}/active/{active}")
    @PreAuthorize("hasRole('ADMIN')")
    public DeliveryPartner setActive(@PathVariable @Min(1) Long id,
                                     @PathVariable boolean active,
                                     Authentication auth) {
        return partners.setActive(id, active, actor(auth));
    }

    /** Hard delete (admin; prefer setActive(false)). */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable @Min(1) Long id) {
        partners.delete(id);
    }

    // ── helpers ───────────────────────────────────────────────────────────────
    private String actor(Authentication auth) {
        return (auth != null && auth.getName() != null) ? auth.getName() : "system";
    }
}
