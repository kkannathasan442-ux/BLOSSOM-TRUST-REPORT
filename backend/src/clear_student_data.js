require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// 1. Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// 2. Initialize SQLite
const dbPath = path.resolve(__dirname, '../database.sqlite');
const db = new sqlite3.Database(dbPath);

const runQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function clearStudentData() {
  console.log("=========================================");
  console.log("🔥 DELETING ALL STUDENT DATA & ACCOUNTS...");
  console.log("=========================================");

  try {
    // A. Clean remote Supabase Database
    console.log("🔌 Fetching student users from Supabase...");
    const { data: studentUsers, error: fetchError } = await supabase
      .from('users')
      .select('id, email')
      .eq('role', 'student');

    if (fetchError) {
      throw new Error(`Failed to fetch student users: ${fetchError.message}`);
    }

    console.log(`📊 Found ${studentUsers.length} student user accounts to delete.`);

    if (studentUsers.length > 0) {
      console.log("🧼 Deleting accounts from Supabase Auth (cascades to profiles and edit requests)...");
      let deletedCount = 0;
      
      for (const user of studentUsers) {
        console.log(`👉 Deleting student account: ${user.email} (${user.id})...`);
        const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
        
        if (deleteError) {
          console.warn(`⚠️ Warning: Failed to delete auth user ${user.email}: ${deleteError.message}`);
          
          // Fallback: If auth delete failed or was already deleted, clean up public.users directly
          console.log(`   Attempting direct public.users delete fallback for ${user.email}...`);
          await supabase.from('users').delete().eq('id', user.id);
        } else {
          deletedCount++;
        }
        
        // Brief delay to respect rate limits
        await delay(100);
      }
      
      console.log(`✅ Supabase Auth cleanup finished. Deleted ${deletedCount} auth accounts.`);
    }

    // B. Clean local SQLite Database
    console.log("\n📦 Deleting student records from local SQLite...");
    await runQuery('PRAGMA foreign_keys = ON;');
    
    const sqliteResult = await runQuery("DELETE FROM users WHERE role = 'student'");
    console.log(`✅ Local SQLite database cleared. (Deleted student users: ${sqliteResult.changes})`);

    console.log("\n🎉 SUCCESS: All student profiles and user accounts have been deleted completely.");
  } catch (err) {
    console.error("\n❌ Error deleting student data:", err.message || err);
  } finally {
    db.close();
  }
}

clearStudentData();
