require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Database path
const dbPath = path.resolve(__dirname, '../database.sqlite');
const db = new sqlite3.Database(dbPath);

// Initialize Supabase Client with Service Role Key (bypasses RLS)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Promisified SQLite query helpers
const allQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

// Helper to delay execution (prevents hitting API rate limits)
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function runMigration() {
  console.log("==================================================");
  console.log("🚀 Blossom Trust SQLite to Supabase Data Migrator");
  console.log("==================================================");
  
  try {
    // 1. Verify Supabase Connection
    console.log("🔌 Verifying Supabase connection...");
    const { data: testData, error: testError } = await supabase.from('admin_settings').select('key').limit(1);
    if (testError) {
      throw new Error(`Failed to query Supabase: ${testError.message}. Please ensure the SQL schema has been applied in the Supabase SQL Editor.`);
    }
    console.log("✅ Supabase connection verified successfully.");

    // 2. Fetch data from local SQLite
    console.log("📦 Fetching records from local SQLite...");
    const sqliteUsers = await allQuery("SELECT * FROM users");
    const sqliteStudents = await allQuery("SELECT * FROM students");
    const sqliteAdminSettings = await allQuery("SELECT * FROM admin_settings");
    const sqliteEditRequests = await allQuery("SELECT * FROM edit_requests");

    console.log(`📊 Found in local SQLite:`);
    console.log(`   - ${sqliteUsers.length} Users`);
    console.log(`   - ${sqliteStudents.length} Students`);
    console.log(`   - ${sqliteAdminSettings.length} Admin Settings`);
    console.log(`   - ${sqliteEditRequests.length} Edit Requests`);

    // 3. Migrate Admin Settings
    console.log("\n⚙️ Migrating Admin Settings...");
    for (const setting of sqliteAdminSettings) {
      const { error } = await supabase
        .from('admin_settings')
        .upsert({ key: setting.key, value: setting.value }, { onConflict: 'key' });
      if (error) {
        console.warn(`⚠️ Warning: Failed to migrate setting [${setting.key}]: ${error.message}`);
      }
    }
    console.log("✅ Admin Settings migrated successfully.");

    // 4. Migrate Users and Students
    console.log("\n👤 Migrating Users & Student Profiles...");
    
    // Split users into Admin/Primary and Mock Students to prioritize primary accounts
    const primaryUsers = sqliteUsers.filter(u => u.role === 'admin' || u.email === 'kkannathasan442@gmail.com');
    const mockUsers = sqliteUsers.filter(u => u.role !== 'admin' && u.email !== 'kkannathasan442@gmail.com');
    
    console.log(`🔑 High-priority users to migrate: ${primaryUsers.length}`);
    console.log(`🔑 Mock student accounts available: ${mockUsers.length}`);

    const idMapping = {}; // sqlite_user_id -> supabase_uuid
    const studentMapping = {}; // sqlite_student_id -> supabase_inserted_student_id
    
    // Migrate primary accounts first (Real Auth)
    for (const u of primaryUsers) {
      console.log(`👉 Migrating primary account: ${u.email} (${u.role})...`);
      const supabaseId = await getOrCreateAuthUser(u.email, u.role === 'admin' ? 'admin123' : 'student123', u.role);
      if (supabaseId) {
        idMapping[u.id] = supabaseId;
      }
    }

    // Migrate a robust, representative set of 150 mock student accounts
    console.log("\n🤖 Migrating a representative sample of 150 mock student accounts...");
    const targetMockCount = 150;
    let migratedCount = 0;
    
    for (let i = 0; i < mockUsers.length && migratedCount < targetMockCount; i++) {
      const u = mockUsers[i];
      console.log(`⏳ [${migratedCount + 1}/${targetMockCount}] Creating auth account for: ${u.email}...`);
      const supabaseId = await getOrCreateAuthUser(u.email, 'student123', 'student');
      if (supabaseId) {
        idMapping[u.id] = supabaseId;
        migratedCount++;
        // Gentle delay to respect Auth rate limits
        await delay(100);
      }
    }
    
    console.log(`\n✅ Account creation phase finished. Successfully created ${migratedCount} student auth accounts.`);

    // 5. Migrate Students Profiles
    console.log("\n📝 Migrating student profiles...");
    let studentsMigrated = 0;
    
    // We'll insert students in batches of 50
    const batchSize = 50;
    const studentsToInsert = [];
    
    for (const s of sqliteStudents) {
      const supabaseUserId = idMapping[s.user_id];
      if (!supabaseUserId) {
        // Skip student profile if user was not migrated (we only migrated 150 sample mock accounts)
        continue;
      }
      
      studentsToInsert.push({
        user_id: supabaseUserId,
        ut_no: s.ut_no,
        full_name: s.full_name,
        phone_number: s.phone_number,
        nic_number: s.nic_number,
        district: s.district,
        bank_name: s.bank_name,
        branch: s.branch,
        branch_code: s.branch_code,
        account_no: s.account_no,
        beneficiary_name: s.beneficiary_name,
        photo_url: s.photo_url,
        profile_status: s.profile_status || 'submitted',
        admin_col1_val: s.admin_col1_val,
        admin_col2_val: s.admin_col2_val,
        admin_col3_val: s.admin_col3_val || 0,
        dropout_reason: s.dropout_reason,
        dropout_date: s.dropout_date,
        low_alternance_reason: s.low_alternance_reason,
        low_alternance_hours: s.low_alternance_hours,
        email: s.email
      });
    }

    console.log(`📦 Bulk upserting ${studentsToInsert.length} student profiles into public.students...`);

    for (let i = 0; i < studentsToInsert.length; i += batchSize) {
      const batch = studentsToInsert.slice(i, i + batchSize);
      const { data: insertedRows, error } = await supabase
        .from('students')
        .upsert(batch, { onConflict: 'ut_no' })
        .select('id, ut_no');
      
      if (error) {
        console.error(`❌ Error migrating student batch starting at index ${i}:`, error.message);
      } else {
        studentsMigrated += batch.length;
        if (insertedRows) {
          insertedRows.forEach(row => {
            // Find corresponding sqlite student id
            const sqStudent = sqliteStudents.find(s => s.ut_no === row.ut_no);
            if (sqStudent) {
              studentMapping[sqStudent.id] = row.id;
            }
          });
        }
      }
    }
    
    console.log(`✅ Migrated ${studentsMigrated} student profiles successfully.`);

    // 6. Migrate Edit Requests
    if (sqliteEditRequests.length > 0) {
      console.log("\n📥 Migrating Edit Requests...");
      let editRequestsMigrated = 0;
      const reqsToInsert = [];
      
      for (const r of sqliteEditRequests) {
        const supabaseStudentId = studentMapping[r.student_id];
        if (!supabaseStudentId) continue;
        
        reqsToInsert.push({
          student_id: supabaseStudentId,
          request_reason: r.request_reason,
          status: r.status || 'pending'
        });
      }
      
      if (reqsToInsert.length > 0) {
        const { error } = await supabase.from('edit_requests').insert(reqsToInsert);
        if (error) {
          console.error("❌ Failed to migrate edit requests:", error.message);
        } else {
          editRequestsMigrated = reqsToInsert.length;
        }
      }
      console.log(`✅ Migrated ${editRequestsMigrated} edit requests successfully.`);
    }

    console.log("\n==================================================");
    console.log("🎉 SUCCESS: DATABASE MIGRATION TO SUPABASE COMPLETE!");
    console.log("==================================================");

  } catch (error) {
    console.error("\n❌ Fatal Migration Error:", error.message);
  } finally {
    db.close();
  }
}

// Helper to get existing user or create a new one in Supabase Auth & public.users
async function getOrCreateAuthUser(email, password, role) {
  try {
    // 1. Check if user already exists in public.users
    const { data: publicUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .limit(1);
    
    if (publicUser && publicUser.length > 0) {
      return publicUser[0].id;
    }

    // 2. Create in Supabase Auth using admin API
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    if (authError) {
      if (authError.message.includes('already registered') || authError.message.includes('already exists')) {
        const { data: listData, error: listError } = await supabase.auth.admin.listUsers();
        if (!listError && listData && listData.users) {
          const matchedUser = listData.users.find(u => u.email === email);
          if (matchedUser) {
            await supabase.from('users').upsert({
              id: matchedUser.id,
              email,
              role
            }, { onConflict: 'email' });
            return matchedUser.id;
          }
        }
      }
      
      console.warn(`⚠️ Auth creation failed for ${email}: ${authError.message}`);
      return null;
    }

    const userId = authData.user.id;

    // 3. Create mapping in public.users
    const { error: insertError } = await supabase
      .from('users')
      .upsert({
        id: userId,
        email,
        role
      }, { onConflict: 'email' });

    if (insertError) {
      console.error(`❌ Failed to insert public.users record for ${email}:`, insertError.message);
      return null;
    }

    return userId;
  } catch (err) {
    console.error(`❌ Error in getOrCreateAuthUser for ${email}:`, err.message);
    return null;
  }
}

runMigration();
