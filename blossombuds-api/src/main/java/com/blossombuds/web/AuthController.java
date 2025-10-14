package com.blossombuds.web;

import com.blossombuds.dto.AuthDto.LoginRequest;
import com.blossombuds.dto.AuthDto.TokenResponse;
import com.blossombuds.service.AuthService;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

/** Login/logout endpoints for JWT auth. */
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/auth")
public class AuthController {
    private final AuthService auth;

    /** POST /api/auth/login — returns { token } on success. */
    @PostMapping("/login")
    public TokenResponse login(@Valid @RequestBody LoginRequest req) {
        return new TokenResponse(auth.login(req));
    }

    /** POST /api/auth/logout — stateless logout; client must discard token. */
    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout(HttpServletResponse res) {
        // If you ever store JWT in an httpOnly cookie, clear it here:
        // ResponseCookie cleared = ResponseCookie.from("AUTH", "").maxAge(0).path("/").build();
        // res.addHeader(HttpHeaders.SET_COOKIE, cleared.toString());
        // For Authorization header tokens, frontend just removes it.
    }
}
