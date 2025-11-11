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

import java.util.*;
import java.util.stream.Collectors;

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
        return customerRepo.save(c);
    }

    /** Updates basic customer fields. */
    @Transactional
    // @PreAuthorize("hasRole('ADMIN')")
    public Customer updateCustomer(Long customerId, CustomerDto dto, String actor) {
        if (customerId == null) throw new IllegalArgumentException("customerId is required");
        if (dto == null) throw new IllegalArgumentException("CustomerDto is required");

        Customer c = customerRepo.findById(customerId)
                .orElseThrow(() -> new IllegalArgumentException("Customer not found: " + customerId));

        if (dto.getFullName() != null) c.setName(dto.getFullName());
        if (dto.getEmail() != null)    c.setEmail(dto.getEmail());
        if (dto.getPhone() != null)    c.setPhone(dto.getPhone());
        if (dto.getActive() != null)   c.setActive(dto.getActive());
        return c; // JPA dirty checking
    }

    /** Returns a customer by id or throws if not found. */
    // @PreAuthorize("hasRole('ADMIN')")
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
    // Address View
    // ─────────────────────────────────────────────────────────────
    /**
     * Immutable view for addresses with both IDs and human-readable names.
     * The order of constructor args is important; keep it in sync with usages.
     */
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
            String districtName,
            String stateName,
            String countryName,
            String pincode,
            Boolean isDefault,
            Boolean active
    ) {}

    // ─────────────────────────────────────────────────────────────
    // Addresses
    // ─────────────────────────────────────────────────────────────

    /** Add address → returns enriched view (with names). */
    @Transactional
    @PreAuthorize("hasAnyRole('ADMIN','CUSTOMER')")
    public AddressView addAddress(Long customerId, AddressDto dto, String actor) {
        if (customerId == null) throw new IllegalArgumentException("customerId is required");
        if (dto == null)        throw new IllegalArgumentException("AddressDto is required");

        ensureActorIsAdminOrCustomerSelf(actor, customerId);

        Customer c = customerRepo.findById(customerId)
                .orElseThrow(() -> new IllegalArgumentException("Customer not found: " + customerId));

        Country country = (dto.getCountryId() == null) ? null :
                countryRepository.findById(dto.getCountryId())
                        .orElseThrow(() -> new IllegalArgumentException("Country not found: " + dto.getCountryId()));
        State state = (dto.getStateId() == null) ? null :
                stateRepository.findById(dto.getStateId())
                        .orElseThrow(() -> new IllegalArgumentException("State not found: " + dto.getStateId()));
        District district = (dto.getDistrictId() == null) ? null :
                districtRepository.findById(dto.getDistrictId())
                        .orElseThrow(() -> new IllegalArgumentException("District not found: " + dto.getDistrictId()));

        Address a = new Address();
        a.setCustomer(c);
        a.setName(dto.getName());
        a.setPhone(dto.getPhone());
        a.setLine1(dto.getLine1());
        a.setLine2(dto.getLine2());
        a.setPincode(dto.getPincode());
        a.setCountry(country);
        a.setState(state);
        a.setDistrict(district);
        a.setActive(Boolean.TRUE.equals(dto.getActive()) || dto.getActive() == null);
        a.setIsDefault(Boolean.TRUE.equals(dto.getIsDefault()));

        // If this is the first address for this customer, force default=true
        boolean hasAny = addressRepo.existsByCustomer_IdAndActiveTrue(customerId);
        if (!hasAny) a.setIsDefault(true);

        Address saved = addressRepo.save(a);

        // Ensure single default if this one is set default
        if (Boolean.TRUE.equals(saved.getIsDefault())) {
            unsetOtherDefaults(saved.getCustomer().getId(), saved.getId());
        }

        return toAddressView(saved,
                nameOf(country), nameOf(state), nameOf(district));
    }

    /** Update address → returns enriched view (with names). */
    @Transactional
    @PreAuthorize("hasAnyRole('ADMIN','CUSTOMER')")
    public AddressView updateAddress(Long addressId, AddressDto dto, String actor) {
        if (addressId == null) throw new IllegalArgumentException("addressId is required");
        if (dto == null)       throw new IllegalArgumentException("AddressDto is required");

        Address a = addressRepo.findById(addressId)
                .orElseThrow(() -> new IllegalArgumentException("Address not found: " + addressId));

        ensureActorIsAdminOrCustomerSelf(actor, a.getCustomer().getId());

        Country country = (dto.getCountryId() == null) ? null :
                countryRepository.findById(dto.getCountryId())
                        .orElseThrow(() -> new IllegalArgumentException("Country not found: " + dto.getCountryId()));
        State state = (dto.getStateId() == null) ? null :
                stateRepository.findById(dto.getStateId())
                        .orElseThrow(() -> new IllegalArgumentException("State not found: " + dto.getStateId()));
        District district = (dto.getDistrictId() == null) ? null :
                districtRepository.findById(dto.getDistrictId())
                        .orElseThrow(() -> new IllegalArgumentException("District not found: " + dto.getDistrictId()));

        if (dto.getName()   != null) a.setName(dto.getName());
        if (dto.getPhone()  != null) a.setPhone(dto.getPhone());
        if (dto.getLine1()  != null) a.setLine1(dto.getLine1());
        if (dto.getLine2()  != null) a.setLine2(dto.getLine2());
        if (dto.getPincode()!= null) a.setPincode(dto.getPincode());
        if (country != null)         a.setCountry(country);
        if (state   != null)         a.setState(state);
        if (district!= null)         a.setDistrict(district);
        if (dto.getActive()   != null) a.setActive(dto.getActive());
        if (dto.getIsDefault()!= null) a.setIsDefault(dto.getIsDefault());

        Address saved = addressRepo.save(a);

        if (Boolean.TRUE.equals(saved.getIsDefault())) {
            unsetOtherDefaults(saved.getCustomer().getId(), saved.getId());
        }

        return toAddressView(saved,
                nameOf(saved.getCountry()), nameOf(saved.getState()), nameOf(saved.getDistrict()));
    }

    /** List addresses for a customer → returns enriched views with names (no LAZY hits, no N+1). */
    @Transactional(readOnly = true)
    @PreAuthorize("hasAnyRole('ADMIN','CUSTOMER')")
    public List<AddressView> listAddresses(Long customerId, String actor) {
        if (customerId == null) throw new IllegalArgumentException("customerId is required");
        ensureActorIsAdminOrCustomerSelf(actor, customerId);

        // Prefer deterministic ordering: default first, then newest/ID ASC or DESC as you like
        List<Address> list = addressRepo.findByCustomer_Id(customerId);

        // Batch collect ids for names
        Set<Long> cIds = new HashSet<>();
        Set<Long> sIds = new HashSet<>();
        Set<Long> dIds = new HashSet<>();
        for (Address a : list) {
            if (a.getCountry()  != null) cIds.add(a.getCountry().getId());
            if (a.getState()    != null) sIds.add(a.getState().getId());
            if (a.getDistrict() != null) dIds.add(a.getDistrict().getId());
        }

        Map<Long, Country> cMap = cIds.isEmpty() ? Map.of()
                : countryRepository.findAllById(cIds).stream()
                .collect(Collectors.toMap(Country::getId, x -> x));
        Map<Long, State> sMap = sIds.isEmpty() ? Map.of()
                : stateRepository.findAllById(sIds).stream()
                .collect(Collectors.toMap(State::getId, x -> x));
        Map<Long, District> dMap = dIds.isEmpty() ? Map.of()
                : districtRepository.findAllById(dIds).stream()
                .collect(Collectors.toMap(District::getId, x -> x));

        // Map to views using the caches (no lazy access during JSON serialization)
        List<AddressView> views = list.stream()
                .map(a -> {
                    String countryName  = a.getCountry()  != null ? nameOf(cMap.get(a.getCountry().getId()))   : null;
                    String stateName    = a.getState()    != null ? nameOf(sMap.get(a.getState().getId()))     : null;
                    String districtName = a.getDistrict() != null ? nameOf(dMap.get(a.getDistrict().getId()))  : null;
                    return toAddressView(a, countryName, stateName, districtName);
                })
                // default first; then by id asc for stability
                .sorted(Comparator.<AddressView, Boolean>comparing(v -> !Boolean.TRUE.equals(v.isDefault()))
                        .thenComparing(AddressView::id))
                .toList();

        return views;
    }

    /** Mark address as default → returns enriched view. */
    @Transactional
    @PreAuthorize("hasAnyRole('ADMIN','CUSTOMER')")
    public AddressView setDefaultAddress(Long addressId, String actor) {
        if (addressId == null) throw new IllegalArgumentException("addressId is required");

        Address a = addressRepo.findById(addressId)
                .orElseThrow(() -> new IllegalArgumentException("Address not found: " + addressId));

        ensureActorIsAdminOrCustomerSelf(actor, a.getCustomer().getId());

        a.setIsDefault(Boolean.TRUE);
        Address saved = addressRepo.save(a);
        unsetOtherDefaults(saved.getCustomer().getId(), saved.getId());

        return toAddressView(saved,
                nameOf(saved.getCountry()), nameOf(saved.getState()), nameOf(saved.getDistrict()));
    }

    /** Soft-delete (active=false). */
    @Transactional
    @PreAuthorize("hasAnyRole('ADMIN','CUSTOMER')")
    public void deleteAddress(Long addressId, String actor) {
        if (addressId == null) throw new IllegalArgumentException("addressId is required");

        Address a = addressRepo.findById(addressId)
                .orElseThrow(() -> new IllegalArgumentException("Address not found: " + addressId));

        ensureActorIsAdminOrCustomerSelf(actor, a.getCustomer().getId());

        a.setActive(Boolean.FALSE);
        a.setIsDefault(Boolean.FALSE);
        // flush on commit
    }

    // ─────────────────────────────────────────────────────────────
    // Internal helpers
    // ─────────────────────────────────────────────────────────────

    /** Build a single AddressView while supplying names (so we don’t touch LAZY in the record). */
    private AddressView toAddressView(Address a, String countryName, String stateName, String districtName) {
        Long countryId  = a.getCountry()  != null ? a.getCountry().getId()  : null;
        Long stateId    = a.getState()    != null ? a.getState().getId()    : null;
        Long districtId = a.getDistrict() != null ? a.getDistrict().getId() : null;

        return new AddressView(
                a.getId(),
                a.getCustomer() != null ? a.getCustomer().getId() : null,
                a.getName(),
                a.getPhone(),
                a.getLine1(),
                a.getLine2(),
                stateId,
                districtId,
                countryId,
                districtName,
                stateName,
                countryName,
                a.getPincode(),
                a.getIsDefault(),
                a.getActive()
        );
    }

    /** Friendly name extractor (null safe). */
    private static String nameOf(Object entity) {
        if (entity instanceof Country c)  return c.getName();
        if (entity instanceof State s)    return s.getName();
        if (entity instanceof District d) return d.getName();
        return null;
    }

    /** Ensures only one default address exists by unsetting others for the same customer. */
    @Transactional
    protected void unsetOtherDefaults(Long customerId, Long keepAddressId) {
        List<Address> all = addressRepo.findByCustomer_Id(customerId);
        for (Address x : all) {
            if (!x.getId().equals(keepAddressId) && Boolean.TRUE.equals(x.getIsDefault())) {
                x.setIsDefault(Boolean.FALSE);
            }
        }
    }

    /** Verifies the actor is an admin or the same customer (based on JWT subject convention). */
    private void ensureActorIsAdminOrCustomerSelf(String actor, Long targetCustomerId) {
        if (targetCustomerId == null) throw new IllegalArgumentException("targetCustomerId is required");
        if (actor == null || actor.isBlank()) {
            throw new IllegalArgumentException("actor is required");
        }
        // Convention: customer JWT subject is "cust:<id>", admin subject is any non "cust:" string.
        if (actor.startsWith("cust:")) {
            Long cid = parseCustomerId(actor);
            if (!targetCustomerId.equals(cid)) {
                throw new IllegalArgumentException("Operation not permitted for this customer");
            }
        }
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
