package main

import (
	"log"
	"os"

	"dl-platform/auth-service/internal/db"
	"dl-platform/auth-service/internal/handlers"
	"dl-platform/auth-service/internal/middleware"

	"github.com/gin-gonic/gin"
)

func main() {
	// Load config from environment (set via .env or Docker)
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	db.Connect()

	r := gin.Default()

	// CORS — allow the React frontend
	r.Use(corsMiddleware())

	auth := r.Group("/api/auth")
	{
		auth.POST("/register", handlers.Register)
		auth.POST("/login", handlers.Login)
		auth.GET("/logout", handlers.Logout)
		auth.GET("/protected", middleware.RequireAuth, handlers.Protected)
	}

	r.GET("/healthz", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})

	log.Printf("Go auth service running on :%s", port)
	r.Run(":" + port)
}

func corsMiddleware() gin.HandlerFunc {
	allowed := map[string]bool{
		"http://localhost:3000":                        true,
		"http://localhost:3001":                        true,
		"https://plokoon68.github.io":                  true,
		"https://neural-builder.vercel.app":            true,
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
