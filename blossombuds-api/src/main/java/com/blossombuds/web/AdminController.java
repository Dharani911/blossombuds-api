package com.blossombuds.web;

import com.blossombuds.domain.Admin;
import com.blossombuds.domain.Customer;
import com.blossombuds.service.AdminService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/list")
@Validated
public class AdminController {
    private final AdminService adminService;

    @GetMapping
    //@PreAuthorize("hasRole('ADMIN')")
    public List<Admin> list() {
        return adminService.listAll();
    }
}
