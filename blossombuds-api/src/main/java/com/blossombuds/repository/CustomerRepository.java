package com.blossombuds.repository;

import com.blossombuds.domain.Customer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.Set;

/** Repository for customers (active-only by @Where in entity). */
public interface CustomerRepository extends JpaRepository<Customer, Long> {
    Optional<Customer> findByEmail(String email);
    List<Customer> findByNameContainingIgnoreCase(String name);
    Optional<Customer> findByGoogleSubject(String googleSubject);
    Optional<Customer> findByPhone(String phone);

    /** Returns the set of non-null, non-blank phones for all registered customers. */
    @Query("select c.phone from Customer c where c.phone is not null and c.phone <> ''")
    Set<String> findAllRegisteredPhones();

    /** Marketing-email audience: customers with no phone on file (so unreachable via
     *  WhatsApp/SMS, the priority channel) but with an email on file. */
    @Query("select c from Customer c where (c.phone is null or c.phone = '') and c.email is not null and c.email <> ''")
    List<Customer> findMarketingEmailEligible();

    /** Customers who registered before the WhatsApp CRM feature existed and were never asked
     *  for WhatsApp/SMS marketing consent — no row in customer_whatsapp_preferences at all.
     *  Deliberately excludes anyone who already has a preference row, whether opted in or out,
     *  so this never overwrites a choice a customer actually made. Needs phone + email: phone to
     *  message them on, email to notify them of the policy update first. */
    @Query("select c from Customer c where c.active = true "
            + "and c.phone is not null and c.phone <> '' "
            + "and c.email is not null and c.email <> '' "
            + "and not exists (select 1 from CustomerWhatsAppPreference p where p.customerId = c.id)")
    List<Customer> findCustomersNeedingWhatsAppConsentMigration();
}
