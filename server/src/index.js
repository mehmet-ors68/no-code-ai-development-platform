const express = require("express");
const cors = require("cors");
const {connectDB} = require('./db/dbConfig'); // Import your database pool
const cookieParser = require("cookie-parser");

connectDB()
require('dotenv').config({ path: '../.env' });

/*~
const criteriasRoutes = require('./routes/criteriasRoutes');
const decisionMatrixRoutes = require('./routes/decisionMatrixRoutes');
*/
const authRoutes = require('./routes/authRoutes');
const modelsRoutes = require('./routes/modelsRoutes');
const processRoutes = require('./routes/processRoutes');

const app = express();
const port = process.env.PORT || 5000;                                                  
app.use(cors({  
  origin: ["http://localhost", "http://localhost:3000", "http://localhost:3001", 
    "https://plokoon68.github.io",
    "https://neural-builder.vercel.app",
    "https://deep-learning-framework-view.onrender.com"],  // Allow frontend to access backend
  methods: "GET,POST,PUT,DELETE",
  allowedHeaders: "Content-Type,Authorization",
  credentials: true   
}));

app.use(express.json())
app.use(cookieParser());



/*
app.use('/api/criterias', criteriasRoutes);
app.use('/api/decisionMatrix', decisionMatrixRoutes);
*/
app.use('/api/auth', authRoutes);
app.use('/api/models', modelsRoutes);
app.use('/api/process', processRoutes);

// Health check endpoint for Render
/*
app.get('/healthz', (req, res) => {
  res.status(200).send('OK');
});
*/
app.get('/healthz', (req, res) => {
    console.log(`Request received from IP: ${req.ip}`);

  res.status(200).send('OK');
});

//for frontend
app.get('/api/healthz', (req, res) => {
  res.status(200).send('OK');
});


/*
const server = app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
*/

const server = app.listen(port, () => {
  console.log(`Server running on render port:${port}`);
});


/*
// Graceful shutdown on Ctrl+C
process.on('SIGINT', async () => {
  console.log('Received SIGINT, shutting down gracefully...');
  
  try {
    await pool.end(); // Close DB pool
    console.log('Database connection pool closed.');
  } catch (err) {
    console.error('Error closing the database pool:', err);
  }

  server.close(() => {
    console.log('Server closed.');
    process.exit(0); // Exit with a success code
  });
});
*/