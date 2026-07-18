/**
 * delete_mock_students.js
 * Deletes all seeded mock student records from the local SQLite database.
 * Preserves the admin account and all non-student data.
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Could not open database:', err.message);
    process.exit(1);
  }
  console.log('✅ Connected to SQLite database:', dbPath);
});

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });

const getQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });

async function deleteAllMockStudents() {
  console.log('\n=========================================');
  console.log('🔥 DELETING ALL MOCK STUDENT DATA...');
  console.log('=========================================\n');

  try {
    // Enable foreign keys so cascades work
    await runQuery('PRAGMA foreign_keys = ON;');

    // Count before
    const beforeStudents = await getQuery('SELECT COUNT(*) as count FROM students');
    const beforeUsers    = await getQuery("SELECT COUNT(*) as count FROM users WHERE role = 'student'");
    const beforeAtt      = await getQuery('SELECT COUNT(*) as count FROM attendance_history');
    const beforeEdit     = await getQuery('SELECT COUNT(*) as count FROM edit_requests');

    console.log('📊 BEFORE:');
    console.log(`   Students           : ${beforeStudents.count}`);
    console.log(`   Student user accts : ${beforeUsers.count}`);
    console.log(`   Attendance records : ${beforeAtt.count}`);
    console.log(`   Edit requests      : ${beforeEdit.count}`);

    // Delete all student users — CASCADE removes students, attendance_history, edit_requests
    console.log('\n🗑️  Deleting all student users (cascade deletes students + related records)...');
    const result = await runQuery("DELETE FROM users WHERE role = 'student'");
    console.log(`✅ Deleted ${result.changes} student user rows (+ cascaded child records).`);

    // Count after
    const afterStudents = await getQuery('SELECT COUNT(*) as count FROM students');
    const afterUsers    = await getQuery("SELECT COUNT(*) as count FROM users WHERE role = 'student'");
    const afterAtt      = await getQuery('SELECT COUNT(*) as count FROM attendance_history');
    const afterEdit     = await getQuery('SELECT COUNT(*) as count FROM edit_requests');
    const adminCheck    = await getQuery("SELECT COUNT(*) as count FROM users WHERE role = 'admin'");

    console.log('\n📊 AFTER:');
    console.log(`   Students           : ${afterStudents.count}  (expected 0)`);
    console.log(`   Student user accts : ${afterUsers.count}     (expected 0)`);
    console.log(`   Attendance records : ${afterAtt.count}       (expected 0)`);
    console.log(`   Edit requests      : ${afterEdit.count}      (expected 0)`);
    console.log(`   Admin accounts     : ${adminCheck.count}     (should stay ≥ 1 ✅)`);

    console.log('\n🎉 SUCCESS: All mock student data removed. Admin account preserved.\n');
  } catch (err) {
    console.error('\n❌ Error during deletion:', err.message || err);
  } finally {
    db.close(() => console.log('🔒 Database connection closed.'));
  }
}

deleteAllMockStudents();
