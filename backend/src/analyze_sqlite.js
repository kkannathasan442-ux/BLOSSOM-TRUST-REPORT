const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../database.sqlite');
const db = new sqlite3.Database(dbPath);

const getQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const allQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

async function analyze() {
  console.log("Analyzing local SQLite database...");
  try {
    const userCount = await getQuery("SELECT COUNT(*) as count FROM users");
    const studentCount = await getQuery("SELECT COUNT(*) as count FROM students");
    const adminCount = await getQuery("SELECT COUNT(*) as count FROM users WHERE role = 'admin'");
    const studentUsersCount = await getQuery("SELECT COUNT(*) as count FROM users WHERE role = 'student'");
    
    console.log(`Total users in SQLite: ${userCount.count}`);
    console.log(`- Admin users: ${adminCount.count}`);
    console.log(`- Student users: ${studentUsersCount.count}`);
    console.log(`Total students in SQLite: ${studentCount.count}`);
    
    // Check if there are any non-standard users
    const nonStandardUsers = await allQuery(
      "SELECT email, role FROM users WHERE email NOT LIKE '%@blossomtrust.org'"
    );
    console.log(`Non-standard users (not @blossomtrust.org):`, nonStandardUsers);

    // Check edit requests count
    const editRequestsCount = await getQuery("SELECT COUNT(*) as count FROM edit_requests");
    console.log(`Total edit requests: ${editRequestsCount.count}`);
    
    // Check admin settings
    const adminSettings = await allQuery("SELECT * FROM admin_settings");
    console.log(`Admin settings:`, adminSettings);
  } catch (err) {
    console.error("Error analyzing SQLite database:", err);
  } finally {
    db.close();
  }
}

analyze();
