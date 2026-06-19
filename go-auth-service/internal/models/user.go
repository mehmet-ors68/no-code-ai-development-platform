package models

import "go.mongodb.org/mongo-driver/v2/bson"

// User mirrors the MongoDB document structure.
type User struct {
	ID       bson.ObjectID `bson:"_id,omitempty" json:"id"`
	Username string             `bson:"username"      json:"username"`
	Email    string             `bson:"email"         json:"email"`
	Password string             `bson:"password"      json:"-"` // never send password in JSON responses
}

// RegisterRequest is the expected body for POST /auth/register.
type RegisterRequest struct {
	Username string `json:"username" binding:"required,min=3"`
	Email    string `json:"email"    binding:"required,email"`
	Password string `json:"password" binding:"required,min=6"`
}

// LoginRequest is the expected body for POST /auth/login.
type LoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}
