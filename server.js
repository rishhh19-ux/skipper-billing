const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'shop.env') });

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const billRoutes = require('./routes/billRoutes');
const authRoutes = require('./routes/authRoutes');

const app = express();
app.use(cors());
app.use(express.json());

// Cached Mongoose connection for serverless / Vercel
let isConnected = false;
const connectDB = async () => {
  if (isConnected || mongoose.connection.readyState >= 1) {
    isConnected = true;
    return;
  }

  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.warn('⚠️ Warning: MONGO_URI is not configured');
    return;
  }

  try {
    const db = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });
    isConnected = db.connections[0].readyState >= 1;
    console.log('✅ Connected to MongoDB');
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
  }
};

// Middleware to ensure database is ready on incoming requests
app.use(async (req, res, next) => {
  await connectDB();
  next();
});

// Serve static frontend UI from public directory
app.use(express.static(path.join(__dirname, 'public')));

// API Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Skipper billing server is running',
    dbConnected: mongoose.connection.readyState >= 1,
  });
});

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/bills', billRoutes);

const PORT = process.env.PORT || 5000;

// Start server locally (Vercel imports app as a serverless handler)
if (!process.env.VERCEL) {
  connectDB().then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 Skipper billing server running on http://localhost:${PORT}`);
    });
  });
}

module.exports = app;
