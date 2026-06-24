package com.aiplatform.javaservice.controller;

import com.aiplatform.javaservice.dto.LoginRequest;
import com.aiplatform.javaservice.dto.RegisterRequest;
import com.aiplatform.javaservice.model.User;
import com.aiplatform.javaservice.repository.UserRepository;
import com.aiplatform.javaservice.service.JwtService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final UserRepository userRepository;
    private final JwtService jwtService;
    private final BCryptPasswordEncoder passwordEncoder;

    @PostMapping("/register")
    public ResponseEntity<?> register(@Valid @RequestBody RegisterRequest req, HttpServletResponse response) {
        if (userRepository.existsByEmail(req.email())) {
            return ResponseEntity.badRequest().body(Map.of("message", "Email already in use"));
        }
        if (userRepository.existsByUsername(req.username())) {
            return ResponseEntity.badRequest().body(Map.of("message", "Username already taken"));
        }

        User user = new User();
        user.setUsername(req.username());
        user.setEmail(req.email());
        user.setPassword(passwordEncoder.encode(req.password()));
        user.setName(req.name());

        User saved = userRepository.save(user);

        // UUID → String for JWT claim — Go Gateway reads this as X-User-ID header
        String token = jwtService.generate(saved.getId().toString(), saved.getEmail());
        setTokenCookie(response, token);

        return ResponseEntity.status(201).body(Map.of(
                "message", "Registration successful",
                "userId", saved.getId().toString()
        ));
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest req, HttpServletResponse response) {
        String id = req.identifier();
        User user = id.contains("@")
                ? userRepository.findByEmail(id).orElse(null)
                : userRepository.findByUsername(id).orElse(null);

        if (user == null || !passwordEncoder.matches(req.password(), user.getPassword())) {
            return ResponseEntity.status(401).body(Map.of("message", "Invalid credentials"));
        }

        String token = jwtService.generate(user.getId().toString(), user.getEmail());
        setTokenCookie(response, token);

        return ResponseEntity.ok(Map.of(
                "message", "Login successful",
                "userId", user.getId().toString()
        ));
    }

    @GetMapping("/logout")
    public ResponseEntity<?> logout(HttpServletResponse response) {
        Cookie cookie = new Cookie("token", "");
        cookie.setHttpOnly(true);
        cookie.setPath("/");
        cookie.setMaxAge(0);
        response.addCookie(cookie);
        return ResponseEntity.ok(Map.of("message", "Logged out"));
    }

    private void setTokenCookie(HttpServletResponse response, String token) {
        Cookie cookie = new Cookie("token", token);
        cookie.setHttpOnly(true);
        cookie.setPath("/");
        cookie.setMaxAge(86400);
        // cookie.setSecure(true); // enable in production (HTTPS only)
        response.addCookie(cookie);
    }
}
