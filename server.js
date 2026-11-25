const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'shop.env') });

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const billRoutes = require('./routes/billRoutes');

const app = express();
app.use(cors());
app.use(express.json());

// Serve static frontend UI from public directory
app.use(express.static(path.join(__dirname, 'public')));

// API Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', message: 'Skipper billing server is running' }));
app.use('/api/bills', billRoutes);

const PORT = process.env.PORT || 5000;

// Connect to MongoDB and start server
const startServer = async () => {
  try {
    if (!process.env.MONGO_URI) {
      console.warn('⚠️ Warning: MONGO_URI is not set in shop.env');
    } else {
      await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
      console.log('✅ Connected to MongoDB');
    }
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err.message);
    console.log('💡 Tip: Make sure your MongoDB service is running or check your connection string in shop.env');
  }

  app.listen(PORT, () => {
    console.log(`🚀 Skipper billing server running on http://localhost:${PORT}`);
  });
};

startServer();