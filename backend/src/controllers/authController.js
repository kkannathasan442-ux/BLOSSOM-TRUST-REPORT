const { supabase, admin: supabaseAdmin } = require('../lib/supabaseClient');

exports.register = async (req, res) => {
  const { email, password, fullName, utNo, studentType = 'blossom' } = req.body;
  if (!email || !password || !fullName || !utNo) {
    return res.status(400).json({ message: 'Email, password, full name, and UT number are required.' });
  }

  try {
    const trimmedEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      return res.status(400).json({ message: 'Invalid email address format.' });
    }

    // Check if user exists in custom users table
    const { data: existingUser } = await supabaseAdmin.from('users').select('id').eq('email', trimmedEmail).maybeSingle();
    if (existingUser) {
      return res.status(400).json({ message: 'Email is already registered.' });
    }

    // Check if student with same UT number exists
    const { data: existingStudent } = await supabaseAdmin.from('students').select('id').eq('ut_no', utNo).maybeSingle();
    if (existingStudent) {
      return res.status(400).json({ message: 'UT Number is already registered.' });
    }

    // 1. Sign up with Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: trimmedEmail,
      password: password,
      email_confirm: true // Auto-confirm for this app
    });

    if (authError) throw authError;

    // 2. Add to public.users table.
    const { error: insertError } = await supabaseAdmin.from('users').insert([{
      id: authData.user.id,
      email: authData.user.email,
      role: 'student'
    }]);
    if (insertError) throw insertError;

    // 3. Create initial student profile
    const studentPayload = {
      user_id: authData.user.id,
      ut_no: utNo,
      full_name: fullName,
      profile_status: 'draft',
      student_type: studentType,
      batch: 'Unicom TIC Class of 2026',
      batch_year: 2026,
      email: trimmedEmail
    };

    await supabaseAdmin.from('students').insert([studentPayload]);

    return res.status(201).json({ message: 'Registration successful. Please login.' });
  } catch (error) {
    console.error('Registration Error:', error);
    return res.status(500).json({ message: error.message || 'Error registering user.' });
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  try {
    const trimmedEmail = email.trim().toLowerCase();
    
    // Sign in using Supabase anon client
    const { data, error } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password
    });

    if (error || !data.user) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    // Get the custom role from our users table
    const { data: userData, error: userError } = await supabaseAdmin.from('users').select('role').eq('id', data.user.id).maybeSingle();
    if (userError || !userData) {
      return res.status(401).json({ message: 'User role not found.' });
    }

    // Supabase access token will be used by the frontend
    const token = data.session.access_token;
    
    return res.status(200).json({
      message: 'Login successful.',
      token,
      user: {
        id: data.user.id,
        email: data.user.email,
        role: userData.role
      }
    });
  } catch (error) {
    console.error('Login Error:', error);
    return res.status(500).json({ message: 'Error logging in.' });
  }
};

exports.me = async (req, res) => {
  // req.user is populated by verifyToken middleware
  try {
    const { data: userData, error } = await supabaseAdmin.from('users').select('role').eq('id', req.user.id).maybeSingle();
    
    if (error || !userData) {
      return res.status(404).json({ message: 'User not found.' });
    }

    return res.status(200).json({
      id: req.user.id,
      email: req.user.email,
      role: userData.role
    });
  } catch (error) {
    return res.status(500).json({ message: 'Error retrieving user data.' });
  }
};
