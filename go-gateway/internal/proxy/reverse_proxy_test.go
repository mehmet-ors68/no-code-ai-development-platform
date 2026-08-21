package proxy

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

// forward runs one request through To() and returns the headers the downstream
// service actually received.
func forward(t *testing.T, setContext func(*gin.Context), reqHeaders map[string]string) http.Header {
	t.Helper()
	gin.SetMode(gin.TestMode)

	var got http.Header
	downstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		got = r.Header.Clone()
		w.WriteHeader(http.StatusOK)
	}))
	t.Cleanup(downstream.Close)

	r := gin.New()
	r.POST("/api/serve/predict", func(c *gin.Context) {
		setContext(c)
		To(downstream.URL)(c)
	})

	// Served through a real server rather than a recorder: ReverseProxy asks the
	// ResponseWriter for CloseNotify, which httptest.NewRecorder does not implement.
	gateway := httptest.NewServer(r)
	t.Cleanup(gateway.Close)

	req, err := http.NewRequest(http.MethodPost, gateway.URL+"/api/serve/predict", nil)
	if err != nil {
		t.Fatal(err)
	}
	for k, v := range reqHeaders {
		req.Header.Set(k, v)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()

	return got
}

func TestTo_SetsIdentityFromContext(t *testing.T) {
	got := forward(t, func(c *gin.Context) {
		c.Set("userID", "7f3a-user")
		c.Set("modelID", "c81b-model")
	}, map[string]string{"X-API-Key": "dlp_secret"})

	if v := got.Get("X-User-ID"); v != "7f3a-user" {
		t.Errorf("X-User-ID = %q, want 7f3a-user", v)
	}
	if v := got.Get("X-Model-ID"); v != "c81b-model" {
		t.Errorf("X-Model-ID = %q, want c81b-model", v)
	}
	// The raw credential has done its job at the gateway. Forwarding it would put a
	// live key into Python's logs for no reason.
	if v := got.Get("X-API-Key"); v != "" {
		t.Errorf("X-API-Key = %q, want it stripped", v)
	}
}

func TestTo_StripsSpoofedIdentityHeaders(t *testing.T) {
	// A caller naming itself. Nothing in the context, so nothing legitimate replaces
	// these — they must not survive the hop regardless.
	got := forward(t, func(c *gin.Context) {}, map[string]string{
		"X-User-ID":  "someone-elses-uuid",
		"X-Model-ID": "someone-elses-model",
	})

	if v := got.Get("X-User-ID"); v != "" {
		t.Errorf("X-User-ID = %q, want it stripped", v)
	}
	if v := got.Get("X-Model-ID"); v != "" {
		t.Errorf("X-Model-ID = %q, want it stripped", v)
	}
}

func TestTo_ContextIdentityOverridesInbound(t *testing.T) {
	got := forward(t, func(c *gin.Context) {
		c.Set("userID", "real-user")
	}, map[string]string{"X-User-ID": "spoofed-user"})

	if v := got.Get("X-User-ID"); v != "real-user" {
		t.Errorf("X-User-ID = %q, want real-user", v)
	}
}
