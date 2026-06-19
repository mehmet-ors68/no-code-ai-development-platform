package handlers

import (
	"context"
	"net/http"
	"os"
	"time"

	"dl-platform/auth-service/internal/db"
	"dl-platform/auth-service/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"golang.org/x/crypto/bcrypt"
)

func Register(c *gin.Context) {
	var req models.RegisterRequest
	// Gin validates the request body against the binding rules on the struct.
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
		return
	}

	col := db.GetCollection("users")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Check username uniqueness
	if err := col.FindOne(ctx, bson.M{"username": req.Username}).Err(); err != mongo.ErrNoDocuments {
		c.JSON(http.StatusConflict, gin.H{"message": "Username already taken"})
		return
	}

	// Check email uniqueness
	if err := col.FindOne(ctx, bson.M{"email": req.Email}).Err(); err != mongo.ErrNoDocuments {
		c.JSON(http.StatusConflict, gin.H{"message": "Email already registered"})
		return
	}

	hashed, err := bcrypt.GenerateFromPassword([]byte(req.Password), 10)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Server error"})
		return
	}

	user := models.User{
		ID:       bson.NewObjectID(),
		Username: req.Username,
		Email:    req.Email,
		Password: string(hashed),
	}

	if _, err := col.InsertOne(ctx, user); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Server error"})
		return
	}

	setTokenCookie(c, user.ID.Hex())
	c.JSON(http.StatusCreated, gin.H{"message": "Registration successful"})
}

func Login(c *gin.Context) {
	var req models.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
		return
	}

	col := db.GetCollection("users")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var user models.User
	if err := col.FindOne(ctx, bson.M{"username": req.Username}).Decode(&user); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"message": "Invalid credentials"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"message": "Invalid credentials"})
		return
	}

	setTokenCookie(c, user.ID.Hex())
	c.JSON(http.StatusOK, gin.H{"message": "Login successful"})
}

func Logout(c *gin.Context) {
	c.SetCookie("token", "", -1, "/", "", true, true)
	c.JSON(http.StatusOK, gin.H{"message": "Logged out"})
}

func Protected(c *gin.Context) {
	userID := c.MustGet("userID")
	c.JSON(http.StatusOK, gin.H{"message": "Protected data", "userID": userID})
}

// setTokenCookie signs a JWT and writes it as an httpOnly cookie — same behaviour as the Node.js version.
func setTokenCookie(c *gin.Context, userID string) {
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"id":  userID,
		"exp": time.Now().Add(time.Hour).Unix(),
	})

	signed, _ := token.SignedString([]byte(os.Getenv("JWT_SECRET")))

	c.SetCookie("token", signed, 3600, "/", "", true, true)
}
