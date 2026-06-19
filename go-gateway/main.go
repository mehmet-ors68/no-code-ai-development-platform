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
	r.Use(corsMiddleware())

	// Public routes — no JWT check (login / register handled by Java)
	r.Any("/api/auth/*path", proxy.To(javaURL))

	// Protected routes — JWT must be valid; gateway sets X-User-ID header for downstream
	protected := r.Group("/")
	protected.Use(middleware.RequireAuth)
	{
		protected.Any("/api/models/*path",  proxy.To(javaURL))
		protected.Any("/api/process/*path", proxy.To(javaURL))
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
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	}
}
