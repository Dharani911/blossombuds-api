package com.blossombuds.repository;

import com.blossombuds.domain.Setting;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface SettingRepository extends JpaRepository<Setting, Long> {
    Optional<Setting> findByKey(String key); // active-only due to @Where
}
