const { createClient } = require('@supabase/supabase-js');
const config = require('../config/config');

if (!config.SUPABASE_URL || !config.SUPABASE_ANON_KEY) {
  throw new Error('❌ SUPABASE_URL and SUPABASE_ANON_KEY must be provided in environment variables.');
}

// Initialize Supabase Anon Client
const supabase = createClient(
  config.SUPABASE_URL,
  config.SUPABASE_ANON_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// Initialize Supabase Admin Client (Service Role Key) for bypassing RLS on server-side tasks
let supabaseAdmin = supabase;
if (config.SUPABASE_SERVICE_ROLE_KEY) {
  supabaseAdmin = createClient(
    config.SUPABASE_URL,
    config.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
  console.log('✅ Supabase Admin Client initialized.');
} else {
  console.warn('⚠️ SUPABASE_SERVICE_ROLE_KEY is missing. Admin operations may fail due to RLS.');
}

console.log('✅ Supabase Anon Client initialized.');

module.exports = { supabase, admin: supabaseAdmin };
