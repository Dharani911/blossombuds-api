package com.blossombuds.web;

import com.blossombuds.domain.Address;
import com.blossombuds.domain.Customer;
import com.blossombuds.dto.AddressDto;
import com.blossombuds.dto.CustomerDto;
import com.blossombuds.service.CustomerService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** HTTP endpoints for customers and their addresses (active-only by default). */
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/customers")
@Validated
public class CustomerController {

    private final CustomerService customers;

    // ── Customers (admin-managed) ─────────────────────────────────────────────

    /** Creates a customer (admin only). */
    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    @ResponseStatus(HttpStatus.CREATED)
    public Customer create(@Valid @RequestBody CustomerDto dto, Authentication auth) {
        return customers.createCustomer(dto, actor(auth));
    }

    /** Updates a customer by id (admin only). */
    @PatchMapping("/{customerId}")
    //@PreAuthorize("hasRole('ADMIN')")
    public Customer update(@PathVariable Long customerId,
                           @Valid @RequestBody CustomerDto dto,
                           Authentication auth) {
        return customers.updateCustomer(customerId, dto, actor(auth));
    }

    /** Gets a single customer (admin only). */
    @GetMapping("/{customerId}")
    //@PreAuthorize("hasRole('ADMIN')")
    public Customer get(@PathVariable Long customerId) {
        return customers.getCustomer(customerId);
    }

    /** Lists all customers (admin only). */
    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public List<Customer> list() {
        return customers.listCustomers();
    }

    // ── Addresses (customer-owned, admins may act on any) ─────────────────────

    /** Adds an address to a customer (customer must own the id, or admin). */
    @PostMapping("/{customerId}/addresses")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('CUSTOMER','ADMIN')")
    public CustomerService.AddressView addAddress(@PathVariable @Min(1) Long customerId,
                                                  @Valid @RequestBody AddressDto dto,
                                                  Authentication auth) {
        ensureOwnershipOrAdmin(auth, customerId);
        var saved = customers.addAddress(customerId, dto, actor(auth));
        return CustomerService.AddressView.of(saved);
    }

    /** Updates an address; if isDefault=true, it becomes the sole default. */
    @PatchMapping("/addresses/{addressId}")
    @PreAuthorize("hasAnyRole('CUSTOMER','ADMIN')")
    public CustomerService.AddressView updateAddress(@PathVariable @Min(1) Long addressId,
                                 @Valid @RequestBody AddressDto dto,
                                 Authentication auth) {
        // Ownership check is done indirectly in service via address’s customer.
        var saved=customers.updateAddress(addressId, dto, actor(auth));
        return CustomerService.AddressView.of(saved);
    }

    /** Lists addresses for a customer (customer must own the id, or admin). */
    @GetMapping("/{customerId}/addresses")
    @PreAuthorize("hasAnyRole('CUSTOMER','ADMIN')")
    public List<Address> listAddresses(@PathVariable @Min(1) Long customerId,
                                       Authentication auth) {
        ensureOwnershipOrAdmin(auth, customerId);
        return customers.listAddresses(customerId, actor(auth));
    }


    /** Marks a specific address as default for its customer. */
    @PostMapping("/addresses/{addressId}/set-default")
    @PreAuthorize("hasAnyRole('CUSTOMER','ADMIN')")
    public CustomerService.AddressView setDefault(@PathVariable @Min(1) Long addressId, Authentication auth) {
        var saved= customers.setDefaultAddress(addressId, actor(auth));
        return CustomerService.AddressView.of(saved);
    }

    /** Soft-deletes an address (active=false, clears isDefault). */
    @DeleteMapping("/addresses/{addressId}")
    @PreAuthorize("hasAnyRole('CUSTOMER','ADMIN')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteAddress(@PathVariable @Min(1) Long addressId, Authentication auth) {
        customers.deleteAddress(addressId, actor(auth));
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    /** Returns actor string from principal, defaults to "system". */
    private String actor(Authentication auth) {
        return auth != null && auth.getName() != null ? auth.getName() : "system";
    }

    /**
     * Enforces that a CUSTOMER can only target their own customerId.
     * Admins can act on any id.
     * Assumes customer principals are of the form "cust:{id}" (per your JWT).
     */
    private void ensureOwnershipOrAdmin(Authentication auth, Long pathCustomerId) {
        if (auth == null) throw new IllegalArgumentException("Unauthorized");
        boolean isAdmin = auth.getAuthorities().stream()
                .anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()));
        if (isAdmin) return;

        boolean isCustomer = auth.getAuthorities().stream()
                .anyMatch(a -> "ROLE_CUSTOMER".equals(a.getAuthority()));
        if (!isCustomer) throw new IllegalArgumentException("Forbidden");

        Long authCustomerId = parseCustomerId(auth.getName());
        if (authCustomerId == null || !authCustomerId.equals(pathCustomerId)) {
            throw new IllegalArgumentException("You can only access your own addresses");
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
