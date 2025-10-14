package com.blossombuds.repository;

import com.blossombuds.domain.Admin;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

/** CRUD for admins (active-only via @Where on entity). */
public interface AdminRepository extends JpaRepository<Admin, Long> {
    Optional<Admin> findByName(String name);
}
