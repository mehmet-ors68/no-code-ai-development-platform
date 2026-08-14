package main

import (
	"log"
	"net/http"
	"os"
	"strings"

	"dl-platform/gateway/internal/middleware"
	"dl-platform/gateway/internal/proxy"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func main() {
	// Load .env in development. In production (Docker) env vars come from the container.
	_ = godotenv.Load()

	port := os.Getenv("PORT")

	if port == "" {
		port = "8080"
	}

	javaURL   := os.Getenv("JAVA_SERVICE_URL")
	pythonURL := os.Getenv("PYTHON_SERVICE_URL")

	r := gin.Default()
	// Trust only loopback (dev) and Docker internal network (172.16-31.x, 10.x)
	r.SetTrustedProxies([]string{"127.0.0.1", "::1", "172.16.0.0/12", "10.0.0.0/8"})
	r.Use(corsMiddleware())

	// Protected — specific route must be declared before the /api/auth/* wildcard so Gin matches it first.
	// Go handles this itself: no DB query, just reads the userID that RequireAuth already extracted from JWT.
	r.GET("/api/me", middleware.RequireAuth, func(c *gin.Context) {
		userID, _ := c.Get("userID")
		c.JSON(http.StatusOK, gin.H{"userId": userID})
	})

	// Public routes — no JWT check (login / register handled by Java)
	r.Any("/api/auth", proxy.To(javaURL))
	r.Any("/api/auth/*path", proxy.To(javaURL))

	// Protected routes — JWT must be valid; gateway sets X-User-ID header for downstream
	protected := r.Group("/")
	protected.Use(middleware.RequireAuth)
	{
		protected.Any("/api/models",        proxy.To(javaURL))
		protected.Any("/api/models/*path",  proxy.To(javaURL))
		// Dataset rows live in Java; the upload itself goes to Python via /api/ml/datasets
		protected.Any("/api/datasets",       proxy.To(javaURL))
		protected.Any("/api/datasets/*path", proxy.To(javaURL))
		protected.Any("/api/process",       proxy.To(javaURL))
		protected.Any("/api/process/*path", proxy.To(javaURL))
		protected.Any("/api/ml",            proxy.To(pythonURL))
		protected.Any("/api/ml/*path",      proxy.To(pythonURL))
	}

	// Gin registers methods explicitly — unlike Express, a GET route does not
	// answer HEAD. Uptime monitors and load balancer health checks commonly
	// probe with HEAD, so register both.
	healthz := func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok", "service": "go-gateway"})
	}
	r.GET("/healthz", healthz)
	r.HEAD("/healthz", healthz)

	log.Printf("Go Gateway running on :%s  →  java=%s  python=%s", port, javaURL, pythonURL)
	r.Run(":" + port)
}

func corsMiddleware() gin.HandlerFunc {
	allowed := map[string]bool{
		"http://localhost:3000":                                        true,
		"http://localhost:3001":                                        true,
		"http://localhost:5173":                                        true,
		"https://plokoon68.github.io":                                  true,
		"https://neural-builder.vercel.app":                            true,
		"https://deep-learning-framework-view.onrender.com":            true,
		"https://no-code-ai-development-platform.pages.dev":            true,
	}

	return func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")
		isAllowed := allowed[origin] || strings.HasSuffix(origin, ".no-code-ai-development-platform.pages.dev")
		if isAllowed {
			c.Header("Access-Control-Allow-Origin", origin)
			c.Header("Access-Control-Allow-Credentials", "true")
			c.Header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS")
			c.Header("Access-Control-Allow-Headers", "Content-Type,Authorization")
		}

		if c.Request.Method == "OPTIONS" {
			if !isAllowed {
				c.AbortWithStatus(403)
				return
			}
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	}
}
