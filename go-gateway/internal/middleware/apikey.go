package middleware

import (
	"bytes"
	"encoding/json"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
)

const APIKeyHeader = "X-API-Key"

// Named X-API-Key rather than Authorization: this is not a bearer JWT, and conflating
// the two invites every client that reads the docs to build the wrong mental model.
//
// Package-level so the test can shrink the timeout. 2s is a Docker-network hop to Java;
// anything slower is an outage, not latency.
var verifyClient = &http.Client{Timeout: 2 * time.Second}

type verifyResponse struct {
	UserID  string `json:"userId"`
	ModelID string `json:"modelId"`
}

// RequireAPIKey authenticates a caller that has no browser session. It resolves the key
// to its owner and its one model by asking Java, then sets both in the Gin context so
// the proxy can assert them downstream — the same contract RequireAuth provides, so
// every existing ownership check keeps its single meaning of X-User-ID.
func RequireAPIKey(c *gin.Context) {
	key := c.GetHeader(APIKeyHeader)
	if key == "" {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"message": "Missing X-API-Key header"})
		return
	}

	body, err := json.Marshal(map[string]string{"key": key})
	if err != nil {
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"message": "Could not build verification request"})
		return
	}

	resp, err := verifyClient.Post(
		os.Getenv("JAVA_SERVICE_URL")+"/internal/api-keys/verify",
		"application/json",
		bytes.NewReader(body),
	)
	if err != nil {
		// 503, never 401. With Java unreachable this gateway cannot tell a good key from
		// a bad one, and answering 401 asserts something it does not know — it tells the
		// caller to rotate a key that was never bad. Anyone who automated that rotation
		// would turn an outage into a stampede of key regeneration.
		c.AbortWithStatusJSON(http.StatusServiceUnavailable, gin.H{"message": "Key verification unavailable"})
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"message": "Invalid API key"})
		return
	}
	if resp.StatusCode != http.StatusOK {
		c.AbortWithStatusJSON(http.StatusServiceUnavailable, gin.H{"message": "Key verification unavailable"})
		return
	}

	var v verifyResponse
	// A 200 we cannot parse, or one missing either field, is a broken verifier rather
	// than a rejected caller — failing closed here means 503, not 401, for the same
	// reason as above.
	if err := json.NewDecoder(resp.Body).Decode(&v); err != nil || v.UserID == "" || v.ModelID == "" {
		c.AbortWithStatusJSON(http.StatusServiceUnavailable, gin.H{"message": "Key verification unavailable"})
		return
	}

	c.Set("userID", v.UserID)
	c.Set("modelID", v.ModelID)
	c.Next()
}
