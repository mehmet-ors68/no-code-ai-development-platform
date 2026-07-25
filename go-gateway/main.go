package main

import (
	"log"
	"os"

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

	// Public routes — no JWT check (login / register handled by Java)
	r.Any("/api/auth", proxy.To(javaURL))
	r.Any("/api/auth/*path", proxy.To(javaURL))

	// Protected routes — JWT must be valid; gateway sets X-User-ID header for downstream
	protected := r.Group("/")
	protected.Use(middleware.RequireAuth)
	{
		protected.Any("/api/models",        proxy.To(javaURL))
		protected.Any("/api/models/*path",  proxy.To(javaURL))
		protected.Any("/api/process",       proxy.To(javaURL))
		protected.Any("/api/process/*path", proxy.To(javaURL))
		protected.Any("/api/ml",            proxy.To(pythonURL))
		protected.Any("/api/ml/*path",      proxy.To(pythonURL))
	}

	r.GET("/healthz", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok", "service": "go-gateway"})
	})

	log.Printf("Go Gateway running on :%s  →  java=%s  python=%s", port, javaURL, pythonURL)
	r.Run(":" + port)
}

func corsMiddleware() gin.HandlerFunc {
	allowed := map[string]bool{
		"http://localhost:3000":                             true,
		"http://localhost:3001":                             true,
		"http://localhost:5173":                             true,
		"https://plokoon68.github.io":                       true,
		"https://neural-builder.vercel.app":                 true,
		"https://deep-learning-framework-view.onrender.com": true,
	}

	return func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")
		if allowed[origin] {
			c.Header("Access-Control-Allow-Origin", origin)
			c.Header("Access-Control-Allow-Credentials", "true")
			c.Header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS")
			c.Header("Access-Control-Allow-Headers", "Content-Type,Authorization")
		}

		if c.Request.Method == "OPTIONS" {
			if !allowed[origin] {
				c.AbortWithStatus(403)
				return
			}
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	}
}
