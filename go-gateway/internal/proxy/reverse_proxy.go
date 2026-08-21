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
		// Identity is asserted by this gateway and never accepted from the caller. The
		// Del matters: Set alone leaves a client-supplied X-User-ID untouched on any
		// route whose middleware did not happen to overwrite it, which is one forgotten
		// route away from letting a caller name itself.
		c.Request.Header.Del("X-User-ID")
		c.Request.Header.Del("X-Model-ID")
		// The raw key has done its job at this boundary. Forwarding a live credential
		// deeper only widens the set of logs it can land in.
		c.Request.Header.Del("X-API-Key")

		// Forward authenticated user identity — downstream services read this, no JWT needed there
		if userID := c.GetString("userID"); userID != "" {
			c.Request.Header.Set("X-User-ID", userID)
		}
		// Set only by RequireAPIKey: an external caller names no model, so the gateway
		// tells Python which one the key resolved to.
		if modelID := c.GetString("modelID"); modelID != "" {
			c.Request.Header.Set("X-Model-ID", modelID)
		}
		rp.ServeHTTP(c.Writer, c.Request)
	}
}
