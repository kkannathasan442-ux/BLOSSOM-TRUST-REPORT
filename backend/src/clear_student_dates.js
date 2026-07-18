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

async function clearDates() {
  console.log("=========================================");
  console.log("🧹 Clearing Student Dropout Dates...");
  console.log("=========================================");

  try {
    // A. Update remote Supabase database
    console.log("🔌 Updating remote Supabase database...");
    const { data, error } = await supabase
      .from('students')
      .update({
        dropout_date: null,
        dropout_reason: null,
        updated_at: new Date().toISOString()
      })
      .not('dropout_date', 'is', null);

    if (error) {
      throw new Error(`Failed to update Supabase: ${error.message}`);
    }
    console.log("✅ Remote Supabase database updated successfully.");

    // B. Update local SQLite database
    console.log("📦 Updating local SQLite database...");
    await runQuery('PRAGMA foreign_keys = ON;');
    const sqliteResult = await runQuery(`
      UPDATE students 
      SET dropout_date = NULL, 
          dropout_reason = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE dropout_date IS NOT NULL
    `);
    console.log(`✅ Local SQLite database updated successfully. (Changed rows: ${sqliteResult.changes})`);

    console.log("\n🎉 SUCCESS: All student dropout dates have been cleared.");
  } catch (err) {
    console.error("\n❌ Error clearing student dates:", err.message || err);
  } finally {
    db.close();
  }
}

clearDates();
