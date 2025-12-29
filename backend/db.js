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
    // Create workers table with job_title
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
        job_title TEXT DEFAULT 'عامل',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Workers table ready');

    // Check and add missing columns
    const tableInfo = db.prepare("PRAGMA table_info(workers)").all();
    const hasHourlyRate = tableInfo.some(col => col.name === 'hourly_rate');
    const hasJobTitle = tableInfo.some(col => col.name === 'job_title');
    
    if (!hasHourlyRate) {
      console.log('Adding hourly_rate column...');
      db.exec('ALTER TABLE workers ADD COLUMN hourly_rate REAL DEFAULT 50');
    }
    
    if (!hasJobTitle) {
      console.log('Adding job_title column...');
      db.exec('ALTER TABLE workers ADD COLUMN job_title TEXT DEFAULT "عامل"');
    }

    // Attendance table
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

    // Advances table (سلفة)
    db.exec(`
      CREATE TABLE IF NOT EXISTS advances (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        worker_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        date DATE NOT NULL,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE
      )
    `);
    console.log('Advances table ready');

    // Drivers table
    db.exec(`
      CREATE TABLE IF NOT EXISTS drivers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        license_number TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Drivers table ready');

    // Trips table
    db.exec(`
      CREATE TABLE IF NOT EXISTS trips (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        driver_id INTEGER NOT NULL,
        from_location TEXT NOT NULL,
        to_location TEXT NOT NULL,
        date DATE NOT NULL,
        start_time TIME,
        end_time TIME,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE
      )
    `);
    console.log('Trips table ready');

    // Settings table
    db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        hourly_rate REAL DEFAULT 50,
        admin_password TEXT DEFAULT 'admin123',
        company_name TEXT DEFAULT 'شركتك',
        company_logo TEXT
      )
    `);
    console.log('Settings table ready');

    const insertSettings = db.prepare(`
      INSERT OR IGNORE INTO settings (id, hourly_rate, admin_password, company_name) 
      VALUES (1, 50, 'admin123', 'شركتك')
    `);
    insertSettings.run();
    console.log('Default settings inserted');

    // Add sample data only in dev mode
    const workerCount = db.prepare('SELECT COUNT(*) as count FROM workers').get();
    if (workerCount.count === 0 && !process.env.USER_DATA_PATH) {
      const insertWorker = db.prepare(`
        INSERT INTO workers (name, age, phone, national_id, date_joined, hourly_rate, job_title) 
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      const insertWorkers = db.transaction((workers) => {
        for (const worker of workers) {
          insertWorker.run(...worker);
        }
      });

      insertWorkers([
        ['أحمد محمد', 28, '01012345678', '29501011234567', '2024-01-15', 50, 'عامل'],
        ['محمود علي', 32, '01023456789', '29201011234568', '2024-02-01', 55, 'عامل'],
        ['خالد حسن', 25, '01034567890', '29801011234569', '2024-03-10', 45, 'سواق']
      ]);
      console.log('Sample workers inserted');
    }

    // Add sample drivers only in dev mode
    const driverCount = db.prepare('SELECT COUNT(*) as count FROM drivers').get();
    if (driverCount.count === 0 && !process.env.USER_DATA_PATH) {
      const insertDriver = db.prepare(`
        INSERT INTO drivers (name, phone, license_number) 
        VALUES (?, ?, ?)
      `);

      const insertDrivers = db.transaction((drivers) => {
        for (const driver of drivers) {
          insertDriver.run(...driver);
        }
      });

      insertDrivers([
        ['محمد السيد', '01011112222', 'DL123456'],
        ['علي محمود', '01022223333', 'DL789012'],
        ['حسن أحمد', '01033334444', 'DL345678']
      ]);
      console.log('Sample drivers inserted');
    }

    // Add sample trips for first driver
    const tripCount = db.prepare('SELECT COUNT(*) as count FROM trips').get();
    if (tripCount.count === 0 && !process.env.USER_DATA_PATH) {
      // Get first driver ID
      const firstDriver = db.prepare('SELECT id FROM drivers LIMIT 1').get();
      if (firstDriver) {
        const insertTrip = db.prepare(`
          INSERT INTO trips (driver_id, from_location, to_location, date, notes) 
          VALUES (?, ?, ?, ?, ?)
        `);

        const today = new Date().toLocaleDateString('en-CA');
        insertTrip.run(firstDriver.id, 'مكان العمل', 'الميناء', today, 'شحن بضائع');
        insertTrip.run(firstDriver.id, 'مكان العمل', 'المصنع', today, 'نقل مواد');
        
        console.log('Sample trips inserted');
      }
    }

  } catch (error) {
    console.error('Database initialization error:', error);
  }
}

initializeDatabase();

module.exports = db;