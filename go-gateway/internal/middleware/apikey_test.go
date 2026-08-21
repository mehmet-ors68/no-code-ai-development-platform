package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

// fakeJava stands in for java-service's /internal/api-keys/verify.
func fakeJava(t *testing.T, handler http.HandlerFunc) {
	t.Helper()
	srv := httptest.NewServer(handler)
	t.Cleanup(srv.Close)
	t.Setenv("JAVA_SERVICE_URL", srv.URL)
}

// run sends one request through RequireAPIKey and reports what the handler behind it saw.
func run(t *testing.T, key string) (status int, reached bool, userID, modelID string) {
	t.Helper()
	gin.SetMode(gin.TestMode)

	r := gin.New()
	r.POST("/api/serve/predict", RequireAPIKey, func(c *gin.Context) {
		reached = true
		userID = c.GetString("userID")
		modelID = c.GetString("modelID")
		c.Status(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodPost, "/api/serve/predict", nil)
	if key != "" {
		req.Header.Set(APIKeyHeader, key)
	}
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	return w.Code, reached, userID, modelID
}

func TestRequireAPIKey_MissingHeader(t *testing.T) {
	// No call to Java should happen at all — there is nothing to verify.
	fakeJava(t, func(w http.ResponseWriter, r *http.Request) {
		t.Error("Java was called for a request with no API key")
	})

	status, reached, _, _ := run(t, "")

	if status != http.StatusUnauthorized {
		t.Errorf("status = %d, want 401", status)
	}
	if reached {
		t.Error("handler ran without a key")
	}
}

func TestRequireAPIKey_UnknownKey(t *testing.T) {
	fakeJava(t, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
	})

	status, reached, _, _ := run(t, "dlp_nope")

	if status != http.StatusUnauthorized {
		t.Errorf("status = %d, want 401", status)
	}
	if reached {
		t.Error("handler ran for an unknown key")
	}
}

func TestRequireAPIKey_JavaError(t *testing.T) {
	fakeJava(t, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	})

	status, reached, _, _ := run(t, "dlp_whatever")

	// 503, not 401: a broken verifier must not be reported as a bad credential, or
	// callers rotate keys that were never bad.
	if status != http.StatusServiceUnavailable {
		t.Errorf("status = %d, want 503", status)
	}
	if reached {
		t.Error("handler ran while the verifier was down")
	}
}

func TestRequireAPIKey_JavaTimeout(t *testing.T) {
	fakeJava(t, func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(200 * time.Millisecond)
	})

	restore := verifyClient
	verifyClient = &http.Client{Timeout: 20 * time.Millisecond}
	t.Cleanup(func() { verifyClient = restore })

	status, reached, _, _ := run(t, "dlp_slow")

	if status != http.StatusServiceUnavailable {
		t.Errorf("status = %d, want 503", status)
	}
	if reached {
		t.Error("handler ran after the verifier timed out")
	}
}

func TestRequireAPIKey_MalformedVerifyResponse(t *testing.T) {
	// 200 with a missing modelId is a broken verifier, not a rejected caller.
	fakeJava(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"userId":"7f3a"}`))
	})

	status, reached, _, _ := run(t, "dlp_partial")

	if status != http.StatusServiceUnavailable {
		t.Errorf("status = %d, want 503", status)
	}
	if reached {
		t.Error("handler ran on an incomplete verify response")
	}
}

func TestRequireAPIKey_ValidKeySetsIdentity(t *testing.T) {
	var sentKeyInBody bool
	fakeJava(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/internal/api-keys/verify" {
			t.Errorf("verify path = %q", r.URL.Path)
		}
		// The key must travel in the body: a URL is written to every access log on the way.
		buf := make([]byte, r.ContentLength)
		_, _ = r.Body.Read(buf)
		sentKeyInBody = string(buf) == `{"key":"dlp_good"}`

		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"userId":"7f3a-user","modelId":"c81b-model"}`))
	})

	status, reached, userID, modelID := run(t, "dlp_good")

	if status != http.StatusOK || !reached {
		t.Fatalf("status = %d, reached = %v, want 200 and true", status, reached)
	}
	if !sentKeyInBody {
		t.Error("key was not sent to Java in the request body")
	}
	if userID != "7f3a-user" {
		t.Errorf("userID = %q, want 7f3a-user", userID)
	}
	if modelID != "c81b-model" {
		t.Errorf("modelID = %q, want c81b-model", modelID)
	}
}
