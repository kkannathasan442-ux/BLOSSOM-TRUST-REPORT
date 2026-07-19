require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config/config');
const apiRoutes = require('./routes/api');

const app = express();

// CORS
app.use(cors({
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true
}));

// Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Prevent browser and proxy caching on all dynamic API responses
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  next();
});

// API Routes
app.use('/api', apiRoutes);

// Serve static frontend in production
app.use(express.static(path.join(__dirname, '../../frontend/dist')));

// Catch-all to support React Router (client-side routing)
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '../../frontend/dist/index.html'));
  } else {
    next();
  }
});

// Global Error Handler
app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ message: 'File is too large! Maximum allowed size is 5MB for images and 10MB for Excel files.' });
  }
  if (err.message && (err.message.includes('Only JPG') || err.message.includes('Only Excel'))) {
    return res.status(400).json({ message: err.message });
  }
  
  console.error('Server error:', err);
  res.status(500).json({ message: err.message || 'Internal server error occurred.' });
});

// Start server (no SQLite initialization needed — Supabase is remote)
const startServer = async () => {
  try {
    // Verify Supabase connection
    const { supabase } = require('./lib/supabaseClient');
    const { data, error } = await supabase.from('admin_settings').select('key').limit(1);
    
    if (error) {
      console.warn('⚠️  Supabase connection check failed:', error.message);
      console.warn('   The server will start, but database operations may fail.');
      console.warn('   Please ensure your Supabase schema has been created (run supabase_schema.sql).');
    } else {
      console.log('✅ Supabase connection verified successfully.');
    }

    app.listen(config.PORT, () => {
      console.log(`==================================================`);
      console.log(`  Blossom Trust Server running on port ${config.PORT}`);
      console.log(`  Local Endpoint: http://localhost:${config.PORT}`);
      console.log(`  Database: Supabase PostgreSQL`);
      console.log(`==================================================`);
    });
  } catch (error) {
    console.error('Fatal: Failed to start server.', error);
    process.exit(1);
  }
};

if (require.main === module) {
  startServer();
}

module.exports = app;
