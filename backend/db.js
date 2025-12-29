const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

function getDatabasePath() {
  const customPath = process.env.USER_DATA_PATH;
  if (customPath) {
    const dbDir = customPath;
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    const finalPath = path.join(dbDir, 'attendance.db');
    console.log('PROD DB PATH:', finalPath);
    return finalPath;
  }
  return path.join(__dirname, '../attendance.db');
}

const dbPath = getDatabasePath();
const db = new Database(dbPath);

console.log('Database connected successfully');
console.log('Database path:', dbPath);

db.pragma('foreign_keys = ON');

function initializeDatabase() {
  try {
    // Create workers table with hourly_rate
    db.exec(`
      CREATE TABLE IF NOT EXISTS workers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        age INTEGER NOT NULL,
        phone TEXT NOT NULL,
        national_id TEXT NOT NULL UNIQUE,
        date_joined DATE NOT NULL,
        photo TEXT,
        hourly_rate REAL DEFAULT 50,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Workers table ready');

    // Check if hourly_rate column exists, if not add it
    const tableInfo = db.prepare("PRAGMA table_info(workers)").all();
    const hasHourlyRate = tableInfo.some(col => col.name === 'hourly_rate');
    
    if (!hasHourlyRate) {
      console.log('Adding hourly_rate column to existing workers table...');
      db.exec('ALTER TABLE workers ADD COLUMN hourly_rate REAL DEFAULT 50');
      console.log('hourly_rate column added successfully');
    }

    db.exec(`
      CREATE TABLE IF NOT EXISTS attendance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        worker_id INTEGER NOT NULL,
        date DATE NOT NULL,
        check_in TIME,
        lunch_out TIME,
        lunch_in TIME,
        check_out TIME,
        total_hours REAL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE
      )
    `);
    console.log('Attendance table ready');

    db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        hourly_rate REAL DEFAULT 50,
        admin_password TEXT DEFAULT 'admin123'
      )
    `);
    console.log('Settings table ready');

    const insertSettings = db.prepare(`
      INSERT OR IGNORE INTO settings (id, hourly_rate, admin_password) 
      VALUES (1, 50, 'admin123')
    `);
    insertSettings.run();
    console.log('Default settings inserted');

    const count = db.prepare('SELECT COUNT(*) as count FROM workers').get();
    if (count.count === 0 && !process.env.USER_DATA_PATH) {
      const insertWorker = db.prepare(`
        INSERT INTO workers (name, age, phone, national_id, date_joined, hourly_rate) 
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      const insert = db.transaction((workers) => {
        for (const worker of workers) {
          insertWorker.run(...worker);
        }
      });

      insert([
        ['أحمد محمد', 28, '01012345678', '29501011234567', '2024-01-15', 50],
        ['محمود علي', 32, '01023456789', '29201011234568', '2024-02-01', 55],
        ['خالد حسن', 25, '01034567890', '29801011234569', '2024-03-10', 45]
      ]);
      console.log('Sample workers inserted');
    }
  } catch (error) {
    console.error('Database initialization error:', error);
  }
}

initializeDatabase();

module.exports = db;