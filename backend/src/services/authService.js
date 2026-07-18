const { supabase, admin } = require('../lib/supabaseClient');

async function register(data) {
  const { email, password, fullName, utNo } = data;

  if (!email || !password || !fullName || !utNo) {
    throw new Error('Missing fields');
  }

  const cleanEmail = email.toLowerCase();

  // 1. Check existing user
  const { data: exists } = await admin
    .from('users')
    .select('id')
    .eq('email', cleanEmail)
    .maybeSingle();

  if (exists) {
    throw new Error('Email already exists');
  }

  // 2. Create auth user
  const { data: auth, error: authError } =
    await admin.auth.admin.createUser({
      email: cleanEmail,
      password,
      email_confirm: true,
    });

  if (authError) throw authError;

  const userId = auth.user.id;

  // 3. Insert into users table
  const { error: userError } = await admin.from('users').insert({
    id: userId,
    email: cleanEmail,
    role: 'student',
  });

  if (userError) throw userError;

   // 4. AUTO CREATE STUDENT PROFILE (🔥 FIX) - upsert to avoid duplicates
   const { error: studentError } = await admin
     .from('students')
     .upsert(
       {
         user_id: userId,
         full_name: fullName,
         ut_no: utNo,
       },
       { onConflict: 'user_id' }
     );

   if (studentError) throw studentError;

  return {
    message: 'Registered successfully',
    userId,
  };
}

module.exports = { register };
