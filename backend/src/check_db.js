require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  console.log("Checking remote Supabase database stats...");
  try {
    const { count: studentCount, error: err1 } = await supabase
      .from('students')
      .select('*', { count: 'exact', head: true });
    
    if (err1) throw err1;

    const { count: studentUsersCount, error: err2 } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'student');
      
    if (err2) throw err2;

    const { count: dropoutCount, error: err3 } = await supabase
      .from('students')
      .select('*', { count: 'exact', head: true })
      .not('dropout_date', 'is', null);

    if (err3) throw err3;

    console.log(`- Total Student Profiles: ${studentCount}`);
    console.log(`- Total Student Users: ${studentUsersCount}`);
    console.log(`- Students with Dropout Dates: ${dropoutCount}`);
  } catch (err) {
    console.error("Error checking remote database:", err.message || err);
  }
}

check();
