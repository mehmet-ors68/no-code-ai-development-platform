package middleware

import (
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

// RequireAuth validates the JWT from the httpOnly cookie.
// Attach this to any route that needs a logged-in user.
func RequireAuth(c *gin.Context) {
	tokenStr, err := c.Cookie("token")
	if err != nil {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"message": "No token found"})
		return
	}

	token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (any, error) {
		return []byte(os.Getenv("JWT_SECRET")), nil
	})
	if err != nil || !token.Valid {
		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"message": "Invalid or expired token"})
		return
	}

	claims := token.Claims.(jwt.MapClaims)
	c.Set("userID", claims["id"]) // downstream handlers can read this
	c.Next()
}
