package com.blossombuds.service;

import com.blossombuds.domain.*;
import com.blossombuds.dto.AddressDto;
import com.blossombuds.dto.CustomerDto;
import com.blossombuds.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.validation.annotation.Validated;

import java.time.OffsetDateTime;
import java.util.List;

/** Application service for managing customers and their addresses. */
@Service
@Validated
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CustomerService {

    private final CustomerRepository customerRepo;
    private final AddressRepository addressRepo;
    private final DistrictRepository districtRepository;
    private final StateRepository stateRepository;
    private final CountryRepository countryRepository;

    // ─────────────────────────────────────────────────────────────
    // Customers
    // ─────────────────────────────────────────────────────────────

    /** Creates a new customer from DTO. */
    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public Customer createCustomer(CustomerDto dto, String actor) {
        if (dto == null) throw new IllegalArgumentException("CustomerDto is required");
        Customer c = new Customer();
        c.setName(dto.getFullName());
        c.setEmail(dto.getEmail());
        c.setPhone(dto.getPhone());
        c.setActive(dto.getActive() != null ? dto.getActive() : Boolean.TRUE);
        c.setCreatedBy(actor);
        c.setCreatedAt(OffsetDateTime.now());
        return customerRepo.save(c);
    }

    /** Updates basic customer fields. */
    @Transactional
    //@PreAuthorize("hasRole('ADMIN')")
    public Customer updateCustomer(Long customerId, CustomerDto dto, String actor) {
        if (customerId == null) throw new IllegalArgumentException("customerId is required");
        if (dto == null) throw new IllegalArgumentException("CustomerDto is required");
        Customer c = customerRepo.findById(customerId)
                .orElseThrow(() -> new IllegalArgumentException("Customer not found: " + customerId));
        if (dto.getFullName() != null) c.setName(dto.getFullName());
        if (dto.getEmail() != null) c.setEmail(dto.getEmail());
        if (dto.getPhone() != null) c.setPhone(dto.getPhone());
        if (dto.getActive() != null) c.setActive(dto.getActive());
        c.setModifiedBy(actor);
        c.setModifiedAt(OffsetDateTime.now());
        return c; // JPA dirty checking
    }

    /** Returns a customer by id or throws if not found. */
    //@PreAuthorize("hasRole('ADMIN')")
    public Customer getCustomer(Long customerId) {
        if (customerId == null) throw new IllegalArgumentException("customerId is required");
        return customerRepo.findById(customerId)
                .orElseThrow(() -> new IllegalArgumentException("Customer not found: " + customerId));
    }

    /** Lists all customers (admin only). */
    @PreAuthorize("hasRole('ADMIN')")
    public List<Customer> listCustomers() {
        return customerRepo.findAll();
    }

    // ─────────────────────────────────────────────────────────────
    // Addresses
    // ─────────────────────────────────────────────────────────────

    /** Adds an address to a customer; optionally marks it as default (owner or admin). */
    // package com.blossombuds.web.dto; // or wherever you prefer

    public record AddressView(
            Long id,
            Long customerId,
            String name,
            String phone,
            String line1,
            String line2,
            Long stateId,
            Long districtId,
            Long countryId,
            String pincode,
            Boolean isDefault,
            Boolean active
    ) {
        public static AddressView of(com.blossombuds.domain.Address a) {
            return new AddressView(
                    a.getId(),
                    a.getCustomer() != null ? a.getCustomer().getId() : null,
                    a.getName(),
                    a.getPhone(),
                    a.getLine1(),
                    a.getLine2(),
                    a.getState() != null ? a.getState().getId() : null,
                    a.getDistrict() != null ? a.getDistrict().getId() : null,
                    a.getCountry() != null ? a.getCountry().getId() : null,
                    a.getPincode(),
                    a.getIsDefault(),
                    a.getActive()
            );
        }
    }

    @Transactional
    @PreAuthorize("hasAnyRole('ADMIN','CUSTOMER')")
    public AddressView addAddress(Long customerId, AddressDto dto, String actor) {
        if (customerId == null) throw new IllegalArgumentException("customerId is required");
        if (dto == null) throw new IllegalArgumentException("AddressDto is required");

        // Ownership enforcement
        ensureActorIsAdminOrCustomerSelf(actor, customerId);

        Customer c = customerRepo.findById(customerId)
                .orElseThrow(() -> new IllegalArgumentException("Customer not found: " + customerId));

        // ── Optional FKs: only resolve when ids are provided ─────────────────────
        Country country = null;
        if (dto.getCountryId() != null) {
            country = countryRepository.findById(dto.getCountryId())
                    .orElseThrow(() -> new IllegalArgumentException("Country not found: " + dto.getCountryId()));
        }

        State state = null;
        if (dto.getStateId() != null) {
            state = stateRepository.findById(dto.getStateId())
                    .orElseThrow(() -> new IllegalArgumentException("State not found: " + dto.getStateId()));
        }

        District district = null;
        if (dto.getDistrictId() != null) {
            district = districtRepository.findById(dto.getDistrictId())
                    .orElseThrow(() -> new IllegalArgumentException("District not found: " + dto.getDistrictId()));
        }

        // ── Build entity ────────────────────────────────────────────────────────
        Address a = new Address();
        a.setCustomer(c);
        a.setName(dto.getName());                    // required in your UI
        a.setPhone(dto.getPhone());                  // may be null for intl
        a.setLine1(dto.getLine1());                  // required in your UI
        a.setLine2(dto.getLine2());
        a.setPincode(dto.getPincode());              // may be null for intl
        a.setCountry(country);                       // can be null if not provided
        a.setState(state);                           // can be null if not provided
        a.setDistrict(district);                     // can be null if not provided
        a.setActive(Boolean.TRUE.equals(dto.getActive()) || dto.getActive() == null);
        a.setIsDefault(Boolean.TRUE.equals(dto.getIsDefault())); // default false if null
        a.setCreatedBy(actor);
        a.setCreatedAt(OffsetDateTime.now());

        // If this is the customer's FIRST address, make it default automatically
        boolean hasAny = addressRepo.existsByCustomer_IdAndActiveTrue(customerId);
        if (!hasAny) {
            a.setIsDefault(true);
        }

        Address saved = addressRepo.save(a);

        // Ensure single default (optional, uncomment to enforce)
        // if (Boolean.TRUE.equals(saved.getIsDefault())) {
        //     unsetOtherDefaults(customerId, saved.getId());
        // }

        return AddressView.of(saved);
    }

    /** Update address -> return view */
    @Transactional
    @PreAuthorize("hasAnyRole('ADMIN','CUSTOMER')")
    public AddressView updateAddress(Long addressId, AddressDto dto, String actor) {
        if (addressId == null) throw new IllegalArgumentException("addressId is required");
        if (dto == null) throw new IllegalArgumentException("AddressDto is required");

        Address a = addressRepo.findById(addressId)
                .orElseThrow(() -> new IllegalArgumentException("Address not found: " + addressId));

        // Ownership enforcement
        ensureActorIsAdminOrCustomerSelf(actor, a.getCustomer().getId());

        District district = dto.getDistrictId() == null ? null :
                districtRepository.findById(dto.getDistrictId())
                        .orElseThrow(() -> new IllegalArgumentException("District not found: " + dto.getDistrictId()));
        State state = dto.getStateId() == null ? null :
                stateRepository.findById(dto.getStateId())
                        .orElseThrow(() -> new IllegalArgumentException("State not found: " + dto.getStateId()));
        Country country = dto.getCountryId() == null ? null :
                countryRepository.findById(dto.getCountryId())
                        .orElseThrow(() -> new IllegalArgumentException("Country not found: " + dto.getCountryId()));

        if (dto.getName() != null) a.setName(dto.getName());
        if (dto.getPhone() != null) a.setPhone(dto.getPhone());
        if (dto.getLine1() != null) a.setLine1(dto.getLine1());
        if (dto.getLine2() != null) a.setLine2(dto.getLine2());
        if (district != null) a.setDistrict(district);
        if (state != null) a.setState(state);
        if (dto.getPincode() != null) a.setPincode(dto.getPincode());
        if (country != null) a.setCountry(country);
        if (dto.getActive() != null) a.setActive(dto.getActive());
        if (dto.getIsDefault() != null) a.setIsDefault(dto.getIsDefault());

        a.setModifiedBy(actor);
        a.setModifiedAt(OffsetDateTime.now());

        Address saved = addressRepo.save(a);

        if (Boolean.TRUE.equals(saved.getIsDefault())) {
            unsetOtherDefaults(saved.getCustomer().getId(), saved.getId());
        }
        return AddressView.of(saved);
    }

    /** List addresses for a customer -> return views */
    @Transactional(readOnly = true)
    @PreAuthorize("hasAnyRole('ADMIN','CUSTOMER')")
    public List<AddressView> listAddresses(Long customerId, String actor) {
        if (customerId == null) throw new IllegalArgumentException("customerId is required");
        ensureActorIsAdminOrCustomerSelf(actor, customerId);
        return addressRepo.findByCustomer_Id(customerId)
                .stream().map(AddressView::of).toList();
    }

    /** Mark address as default -> return view */
    @Transactional
    @PreAuthorize("hasAnyRole('ADMIN','CUSTOMER')")
    public AddressView setDefaultAddress(Long addressId, String actor) {
        if (addressId == null) throw new IllegalArgumentException("addressId is required");
        Address a = addressRepo.findById(addressId)
                .orElseThrow(() -> new IllegalArgumentException("Address not found: " + addressId));

        ensureActorIsAdminOrCustomerSelf(actor, a.getCustomer().getId());

        a.setIsDefault(Boolean.TRUE);
        a.setModifiedBy(actor);
        a.setModifiedAt(OffsetDateTime.now());
        Address saved = addressRepo.save(a);

        unsetOtherDefaults(saved.getCustomer().getId(), saved.getId());
        return AddressView.of(saved);
    }

    /** Soft-delete (active=false) */
    @Transactional
    @PreAuthorize("hasAnyRole('ADMIN','CUSTOMER')")
    public void deleteAddress(Long addressId, String actor) {
        if (addressId == null) throw new IllegalArgumentException("addressId is required");
        Address a = addressRepo.findById(addressId)
                .orElseThrow(() -> new IllegalArgumentException("Address not found: " + addressId));

        ensureActorIsAdminOrCustomerSelf(actor, a.getCustomer().getId());

        a.setActive(Boolean.FALSE);
        a.setIsDefault(Boolean.FALSE);
        a.setModifiedBy(actor);
        a.setModifiedAt(OffsetDateTime.now());
        // flush happens on tx commit
    }

    // ─────────────────────────────────────────────────────────────
    // Internal helpers
    // ─────────────────────────────────────────────────────────────

    /** Ensures only one default address exists by unsetting others for the same customer. */
    @Transactional
    protected void unsetOtherDefaults(Long customerId, Long keepAddressId) {
        List<Address> all = addressRepo.findByCustomer_Id(customerId);
        for (Address x : all) {
            if (!x.getId().equals(keepAddressId) && Boolean.TRUE.equals(x.getIsDefault())) {
                x.setIsDefault(Boolean.FALSE);
            }
        }
        // dirty-checked within the same transaction
    }

    /** Verifies the actor is an admin or the same customer (based on JWT subject convention). */
    private void ensureActorIsAdminOrCustomerSelf(String actor, Long targetCustomerId) {
        if (targetCustomerId == null) throw new IllegalArgumentException("targetCustomerId is required");
        if (actor == null || actor.isBlank()) {
            throw new IllegalArgumentException("actor is required");
        }
        // Convention: customer JWT subject is "cust:<id>", admin subject is admin username (no "cust:" prefix)
        if (actor.startsWith("cust:")) {
            Long cid = parseCustomerId(actor);
            if (!targetCustomerId.equals(cid)) {
                throw new IllegalArgumentException("Operation not permitted for this customer");
            }
        }
        // If not starting with "cust:", we treat it as admin subject. Method security still restricts roles.
    }

    /** Parses customer id from subject "cust:<id>". */
    private Long parseCustomerId(String subject) {
        try {
            return Long.parseLong(subject.substring("cust:".length()));
        } catch (Exception e) {
            throw new IllegalArgumentException("Invalid customer principal");
        }
    }
}
