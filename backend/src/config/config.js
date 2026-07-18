const path = require('path');
const dotenv = require('dotenv');
dotenv.config();

if (!process.env.JWT_SECRET) {
  console.warn('WARNING: JWT_SECRET environment variable is missing.');
}

module.exports = {
  PORT: process.env.PORT || 5000,
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: '24h',
  UPLOAD_DIR: path.resolve(__dirname, '../../uploads'),

  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
};
