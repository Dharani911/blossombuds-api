package com.blossombuds.service;

import com.blossombuds.domain.Admin;
import com.blossombuds.dto.AdminDto;
import com.blossombuds.repository.AdminRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.validation.annotation.Validated;

import java.time.OffsetDateTime;
import java.util.List;

/** Application service for managing back-office admins (creation, updates, lifecycle). */
@Service
@Validated
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AdminService {

    private final AdminRepository adminRepo;

    /** Creates a new admin using the provided DTO and password hash. */
    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public Admin create(AdminDto dto, String passwordHash, String actor) {
        if (dto == null) {
            throw new IllegalArgumentException("AdminDto is required");
        }
        if (passwordHash == null || passwordHash.isBlank()) {
            throw new IllegalArgumentException("passwordHash is required");
        }
        Admin a = new Admin();
        a.setName(dto.getUsername());
        a.setEmail(dto.getEmail());
        //a.setDisplayName(dto.getDisplayName());
        //a.setEnabled(dto.getEnabled() != null ? dto.getEnabled() : Boolean.TRUE);
        a.setActive(dto.getActive() != null ? dto.getActive() : Boolean.TRUE);
        a.setPasswordHash(passwordHash);
        //a.setCreatedBy(actor);
        //a.setCreatedAt(OffsetDateTime.now());
        return adminRepo.save(a);
    }

    /** Updates mutable admin fields (username, email, display name, enabled, active). */
    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public Admin update(Long adminId, AdminDto dto, String actor) {
        if (adminId == null) {
            throw new IllegalArgumentException("adminId is required");
        }
        if (dto == null) {
            throw new IllegalArgumentException("AdminDto is required");
        }
        Admin a = get(adminId);
        if (dto.getUsername() != null) a.setName(dto.getUsername());
        if (dto.getEmail() != null) a.setEmail(dto.getEmail());
        //if (dto.getDisplayName() != null) a.setDisplayName(dto.getDisplayName());
        //if (dto.getEnabled() != null) a.setEnabled(dto.getEnabled());
        if (dto.getActive() != null) a.setActive(dto.getActive());
        //a.setModifiedBy(actor);
        //a.setModifiedAt(OffsetDateTime.now());
        return a; // JPA dirty checking persists changes on tx commit
    }

    /** Sets or rotates the password hash for an admin. */
    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public Admin setPasswordHash(Long adminId, String passwordHash, String actor) {
        if (adminId == null) {
            throw new IllegalArgumentException("adminId is required");
        }
        if (passwordHash == null || passwordHash.isBlank()) {
            throw new IllegalArgumentException("passwordHash is required");
        }
        Admin a = get(adminId);
        a.setPasswordHash(passwordHash);
        //a.setModifiedBy(actor);
        //a.setModifiedAt(OffsetDateTime.now());
        return a;
    }

    /** Enables or disables login access for an admin. */
    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public Admin setEnabled(Long adminId, boolean enabled, String actor) {
        if (adminId == null) {
            throw new IllegalArgumentException("adminId is required");
        }
        Admin a = get(adminId);
        //a.setEnabled(enabled);
        //a.setModifiedBy(actor);
        //a.setModifiedAt(OffsetDateTime.now());
        return a;
    }

    /** Soft-activates or deactivates an admin account. */
    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public Admin setActive(Long adminId, boolean active, String actor) {
        if (adminId == null) {
            throw new IllegalArgumentException("adminId is required");
        }
        Admin a = get(adminId);
        a.setActive(active);
        //a.setModifiedBy(actor);
        //a.setModifiedAt(OffsetDateTime.now());
        return a;
    }

    /** Retrieves an admin by id or throws if not found. */
    public Admin get(Long adminId) {
        if (adminId == null) {
            throw new IllegalArgumentException("adminId is required");
        }
        return adminRepo.findById(adminId)
                .orElseThrow(() -> new IllegalArgumentException("Admin not found: " + adminId));
    }

    /** Lists all admins (active and inactive). */
    public List<Admin> listAll() {
        return adminRepo.findAll();
    }

    /** Permanently deletes an admin (prefer setActive(false) to retain history). */
    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public void delete(Long adminId) {
        if (adminId == null) {
            throw new IllegalArgumentException("adminId is required");
        }
        adminRepo.deleteById(adminId);
    }
}
