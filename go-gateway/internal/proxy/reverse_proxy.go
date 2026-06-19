package proxy

import (
	"net/http"
	"net/http/httputil"
	"net/url"

	"github.com/gin-gonic/gin"
)

// To returns a Gin handler that forwards the request to target, preserving path, method, body, and headers.
// Any userID set by the auth middleware is forwarded as X-User-ID so downstream services
// (Java, Python) can trust it without re-validating the JWT themselves.
func To(target string) gin.HandlerFunc {
	parsed, err := url.Parse(target)
	if err != nil {
		panic("go-gateway: invalid proxy target: " + target)
	}

	rp := httputil.NewSingleHostReverseProxy(parsed)

	// Keep the Host header as the target host, not the original client host.
	// Some backends (Spring Boot) reject requests where Host doesn't match.
	original := rp.Director
	rp.Director = func(req *http.Request) {
		original(req)
		req.Host = parsed.Host
	}

	return func(c *gin.Context) {
		// Forward authenticated user identity — downstream services read this, no JWT needed there
		userID := c.GetString("userID")
		if userID != "" {
			c.Request.Header.Set("X-User-ID", userID)
		}
		rp.ServeHTTP(c.Writer, c.Request)
	}
}
