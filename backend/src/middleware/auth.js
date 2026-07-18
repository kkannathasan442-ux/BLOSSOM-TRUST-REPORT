const { supabase, admin: supabaseAdmin } = require('../lib/supabaseClient');
const NodeCache = require('node-cache');
const authCache = new NodeCache({ stdTTL: 5 }); // Cache for 5 seconds

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access denied. No token provided.' });
  }

  try {
    // 1. Check Cache first
    const cachedUser = authCache.get(token);
    if (cachedUser) {
      req.user = cachedUser;
      return next();
    }

    // 2. Fetch from Supabase if not cached
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return res.status(403).json({ message: 'Invalid or expired token.' });
    }

    // Fetch the custom role from the public.users table using admin client to bypass RLS
    const { data: userData, error: userError } = await supabaseAdmin.from('users').select('role').eq('id', user.id).maybeSingle();
    
    if (userError || !userData) {
      return res.status(403).json({ message: 'User account not found or role not assigned. Please contact an administrator.' });
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: userData.role
    };
    
    // Save to cache
    authCache.set(token, req.user);
    
    next();
  } catch (error) {
    return res.status(403).json({ message: 'Invalid or expired token.' });
  }
};

const isAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied. Administrator privileges required.' });
  }
  next();
};

module.exports = {
  verifyToken,
  isAdmin,
  authCache
};
