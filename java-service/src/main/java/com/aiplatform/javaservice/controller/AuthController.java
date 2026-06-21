package com.aiplatform.javaservice.controller;

import com.aiplatform.javaservice.dto.LoginRequest;
import com.aiplatform.javaservice.dto.RegisterRequest;
import com.aiplatform.javaservice.model.User;
import com.aiplatform.javaservice.repository.UserRepository;
import com.aiplatform.javaservice.service.JwtService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletResponse;
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
    public ResponseEntity<?> register(@RequestBody RegisterRequest req, HttpServletResponse response) {
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

        String token = jwtService.generate(saved.getId(), saved.getEmail());
        setTokenCookie(response, token);

        return ResponseEntity.status(201).body(Map.of(
                "message", "Registration successful",
                "userId", saved.getId()
        ));
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest req, HttpServletResponse response) {
        // Accept either email or username as identifier — like GitHub/HuggingFace
        String id = req.identifier();
        User user = id.contains("@")
                ? userRepository.findByEmail(id).orElse(null)
                : userRepository.findByUsername(id).orElse(null);

        if (user == null || !passwordEncoder.matches(req.password(), user.getPassword())) {
            return ResponseEntity.status(401).body(Map.of("message", "Invalid credentials"));
        }

        String token = jwtService.generate(user.getId(), user.getEmail());
        setTokenCookie(response, token);

        return ResponseEntity.ok(Map.of(
                "message", "Login successful",
                "userId", user.getId()
        ));
    }

    @GetMapping("/logout")
    public ResponseEntity<?> logout(HttpServletResponse response) {
        Cookie cookie = new Cookie("token", "");
        cookie.setHttpOnly(true);
        cookie.setPath("/");
        cookie.setMaxAge(0);  // maxAge 0 = delete the cookie
        response.addCookie(cookie);
        return ResponseEntity.ok(Map.of("message", "Logged out"));
    }

    private void setTokenCookie(HttpServletResponse response, String token) {
        Cookie cookie = new Cookie("token", token);
        cookie.setHttpOnly(true);   // JS cannot read this cookie — XSS protection
        cookie.setPath("/");
        cookie.setMaxAge(86400);    // 24 hours in seconds
        // cookie.setSecure(true);  // uncomment in production: HTTPS only
        response.addCookie(cookie);
    }
}
