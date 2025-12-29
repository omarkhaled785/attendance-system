const express = require('express');
const cors = require('cors');
const db = require('./db');
const BackupSystem = require('./backup');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3001;

const backupSystem = new BackupSystem();
backupSystem.startAutoBackup();

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ============= APIs العمال =============

app.get('/api/workers', (req, res) => {
  try {
    const workers = db.prepare('SELECT * FROM workers ORDER BY name').all();
    res.json(workers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/workers/drivers', (req, res) => {
  try {
    const drivers = db.prepare("SELECT * FROM workers WHERE job_title = 'سواق' ORDER BY name").all();
    res.json(drivers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/workers', (req, res) => {
  try {
    const { name, age, phone, national_id, date_joined, photo, hourly_rate, job_title } = req.body;
    const stmt = db.prepare(`
      INSERT INTO workers (name, age, phone, national_id, date_joined, photo, hourly_rate, job_title) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(name, age, phone, national_id, date_joined, photo || null, hourly_rate || 50, job_title || 'عامل');
    res.json({ 
      id: result.lastInsertRowid, 
      name, age, phone, national_id, date_joined, photo, 
      hourly_rate: hourly_rate || 50,
      job_title: job_title || 'عامل'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/workers/:id', (req, res) => {
  try {
    const worker = db.prepare('SELECT * FROM workers WHERE id = ?').get(req.params.id);
    if (!worker) return res.status(404).json({ error: 'Worker not found' });
    res.json(worker);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/workers/:id/hourly-rate', (req, res) => {
  try {
    const { rate } = req.body;
    const stmt = db.prepare('UPDATE workers SET hourly_rate = ? WHERE id = ?');
    stmt.run(parseFloat(rate), req.params.id);
    res.json({ success: true, rate: parseFloat(rate) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/workers/:id', (req, res) => {
  try {
    const stmt = db.prepare('DELETE FROM workers WHERE id = ?');
    const result = stmt.run(req.params.id);
    res.json({ deleted: result.changes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============= Advances APIs =============

app.post('/api/advances', (req, res) => {
  try {
    const { workerId, amount, date, notes } = req.body;
    const stmt = db.prepare('INSERT INTO advances (worker_id, amount, date, notes) VALUES (?, ?, ?, ?)');
    const result = stmt.run(workerId, amount, date, notes || null);
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/advances/:workerId', (req, res) => {
  try {
    const advances = db.prepare('SELECT * FROM advances WHERE worker_id = ? ORDER BY date DESC').all(req.params.workerId);
    const total = advances.reduce((sum, adv) => sum + adv.amount, 0);
    res.json({ advances, total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============= Driver Trips APIs =============

app.post('/api/driver-trips', (req, res) => {
  try {
    const { driverId, fromLocation, toLocation, departureTime, arrivalTime, date, notes } = req.body;
    const stmt = db.prepare(`
      INSERT INTO driver_trips (driver_id, from_location, to_location, departure_time, arrival_time, date, notes) 
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(driverId, fromLocation, toLocation, departureTime || null, arrivalTime || null, date, notes || null);
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/driver-trips/:driverId', (req, res) => {
  try {
    const trips = db.prepare('SELECT * FROM driver_trips WHERE driver_id = ? ORDER BY date DESC, departure_time DESC').all(req.params.driverId);
    res.json(trips);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/driver-trips/today/:driverId', (req, res) => {
  try {
    const today = new Date().toLocaleDateString('en-CA');
    const trips = db.prepare('SELECT * FROM driver_trips WHERE driver_id = ? AND date = ? ORDER BY departure_time DESC').all(req.params.driverId, today);
    res.json(trips);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Calculate work days excluding Fridays
function calculateWorkDays(startDate, endDate) {
  let workDays = 0;
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dayOfWeek = d.getDay();
    if (dayOfWeek !== 5) { // 5 = Friday
      workDays++;
    }
  }
  return workDays;
}

app.get('/api/workers/:id/report', (req, res) => {
  try {
    const { id } = req.params;
    const { period } = req.query;
    
    const today = new Date().toLocaleDateString('en-CA');
    let startDate = '';
    
    if (period === 'daily') {
      startDate = today;
    } else if (period === 'monthly') {
      const date = new Date();
      startDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
    } else if (period === 'yearly') {
      const date = new Date();
      startDate = `${date.getFullYear()}-01-01`;
    }
    
    const query = `
      SELECT date, check_in, check_out, total_hours
      FROM attendance
      WHERE worker_id = ? AND date >= ? AND date <= ?
      ORDER BY date DESC
    `;
    
    const attendance = db.prepare(query).all(id, startDate, today);
    const totalHours = attendance.reduce((sum, row) => sum + (parseFloat(row.total_hours) || 0), 0);
    const daysWorked = attendance.filter(r => r.check_in).length;
    
    res.json({
      attendance,
      summary: { totalHours: totalHours.toFixed(2), daysWorked }
    });
  } catch (err) {
    console.error('Worker report error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/attendance/today', (req, res) => {
  try {
    const today = new Date().toLocaleDateString('en-CA');
    const query = `
      SELECT w.id, w.name, w.job_title, a.check_in, a.lunch_out, a.lunch_in, a.check_out, a.total_hours
      FROM workers w
      LEFT JOIN attendance a ON w.id = a.worker_id AND a.date = ?
      ORDER BY w.name
    `;
    const rows = db.prepare(query).all(today);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/attendance/reset-today', (req, res) => {
  try {
    const today = new Date().toLocaleDateString('en-CA');
    const stmt = db.prepare('DELETE FROM attendance WHERE date = ?');
    const result = stmt.run(today);
    res.json({ success: true, deleted: result.changes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/attendance/add-bonus', (req, res) => {
  try {
    const { workerId, bonusHours, date } = req.body;
    
    const row = db.prepare('SELECT * FROM attendance WHERE worker_id = ? AND date = ?').get(workerId, date);
    
    if (!row) {
      db.prepare('INSERT INTO attendance (worker_id, date, total_hours) VALUES (?, ?, ?)').run(workerId, date, bonusHours);
    } else {
      const newTotal = (parseFloat(row.total_hours) || 0) + parseFloat(bonusHours);
      db.prepare('UPDATE attendance SET total_hours = ? WHERE worker_id = ? AND date = ?').run(newTotal, workerId, date);
    }
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/attendance/record', (req, res) => {
  try {
    const { workerId, type } = req.body;
    const today = new Date().toLocaleDateString('en-CA');
    const now = new Date().toTimeString().split(' ')[0];
    
    const row = db.prepare('SELECT * FROM attendance WHERE worker_id = ? AND date = ?').get(workerId, today);
    
    if (!row) {
      if (type !== 'check_in') {
        return res.status(400).json({ error: 'يجب تسجيل الحضور أولاً' });
      }
      db.prepare('INSERT INTO attendance (worker_id, date, check_in) VALUES (?, ?, ?)').run(workerId, today, now);
      return res.json({ success: true, time: now });
    }
    
    if (type === 'check_in') {
      if (row.check_in) {
        return res.status(400).json({ error: 'تم تسجيل الحضور بالفعل' });
      }
    }
    
    if (type === 'lunch_out') {
      if (!row.check_in) {
        return res.status(400).json({ error: 'يجب تسجيل الحضور أولاً' });
      }
      if (row.check_out) {
        return res.status(400).json({ error: 'العامل غادر بالفعل - السجل مغلق' });
      }
      if (row.lunch_out) {
        return res.status(400).json({ error: 'تم تسجيل خروج الغداء بالفعل' });
      }
    }
    
    if (type === 'lunch_in') {
      if (!row.lunch_out) {
        return res.status(400).json({ error: 'يجب تسجيل خروج الغداء أولاً' });
      }
      if (row.check_out) {
        return res.status(400).json({ error: 'العامل غادر بالفعل - السجل مغلق' });
      }
      if (row.lunch_in) {
        return res.status(400).json({ error: 'تم تسجيل العودة من الغداء بالفعل' });
      }
    }
    
    if (type === 'check_out') {
      if (!row.check_in) {
        return res.status(400).json({ error: 'يجب تسجيل الحضور أولاً' });
      }
      
      if (row.lunch_out && !row.lunch_in) {
        return res.status(400).json({ error: 'يجب تسجيل العودة من الغداء أولاً' });
      }
      
      if (row.check_out) {
        return res.status(400).json({ error: 'تم تسجيل الانصراف بالفعل' });
      }
    }
    
    let totalHours = 0;
    
    if (type === 'check_in') {
      db.prepare('UPDATE attendance SET check_in = ?, total_hours = 0 WHERE worker_id = ? AND date = ?')
        .run(now, workerId, today);
    } 
    else if (type === 'lunch_out') {
      db.prepare('UPDATE attendance SET lunch_out = ? WHERE worker_id = ? AND date = ?')
        .run(now, workerId, today);
    } 
    else if (type === 'lunch_in') {
      db.prepare('UPDATE attendance SET lunch_in = ? WHERE worker_id = ? AND date = ?')
        .run(now, workerId, today);
    } 
    else if (type === 'check_out') {
      totalHours = calculateTotalHours(row.check_in, now, row.lunch_out, row.lunch_in);
      db.prepare('UPDATE attendance SET check_out = ?, total_hours = ? WHERE worker_id = ? AND date = ?')
        .run(now, totalHours, workerId, today);
    }
    
    res.json({ success: true, time: now, totalHours });
  } catch (err) {
    console.error('Attendance record error:', err);
    res.status(500).json({ error: err.message });
  }
});

function calculateTotalHours(checkIn, checkOut, lunchOut, lunchIn) {
  if (!checkIn || !checkOut) return 0;

  const start = parseTime(checkIn);
  const end = parseTime(checkOut);
  let totalMinutes = (end - start) / (1000 * 60);

  if (lunchOut && lunchIn) {
    const lunchStart = parseTime(lunchOut);
    const lunchEnd = parseTime(lunchIn);
    const lunchMinutes = (lunchEnd - lunchStart) / (1000 * 60);
    totalMinutes -= lunchMinutes;
  }

  return Math.max(0, totalMinutes / 60).toFixed(2);
}

function parseTime(timeString) {
  const [hours, minutes, seconds] = timeString.split(':');
  const date = new Date();
  date.setHours(parseInt(hours), parseInt(minutes), parseInt(seconds || 0), 0);
  return date;
}

// ============= APIs التقارير =============

app.get('/api/reports/daily/:date', (req, res) => {
  try {
    const query = `
      SELECT w.name, w.hourly_rate, a.check_in, a.check_out, a.total_hours
      FROM attendance a
      JOIN workers w ON a.worker_id = w.id
      WHERE a.date = ?
      ORDER BY w.name
    `;
    const rows = db.prepare(query).all(req.params.date);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/reports/weekly', (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date ? new Date(date) : new Date();
    
    const weekStart = new Date(targetDate);
    weekStart.setDate(weekStart.getDate() - 6);
    
    const startDateStr = weekStart.toLocaleDateString('en-CA');
    const endDateStr = targetDate.toLocaleDateString('en-CA');
    
    console.log(`📅 Weekly report: ${startDateStr} to ${endDateStr}`);
    
    const query = `
      SELECT 
        w.name,
        w.hourly_rate,
        COUNT(DISTINCT CASE 
          WHEN a.check_in IS NOT NULL THEN a.date 
        END) as days_present,
        COALESCE(SUM(a.total_hours), 0) as total_hours
      FROM workers w
      LEFT JOIN attendance a ON w.id = a.worker_id
        AND a.date >= ?
        AND a.date <= ?
      GROUP BY w.id, w.name, w.hourly_rate
      ORDER BY w.name
    `;
    
    const rows = db.prepare(query).all(startDateStr, endDateStr);
    
    res.json(rows);
  } catch (err) {
    console.error('Weekly report error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/reports/monthly', (req, res) => {
  try {
    const { year, month } = req.query;
    const targetYear = year ? parseInt(year) : new Date().getFullYear();
    const targetMonth = month ? parseInt(month) : new Date().getMonth() + 1;
    
    const startDate = `${targetYear}-${String(targetMonth).padStart(2, '0')}-01`;
    const lastDay = new Date(targetYear, targetMonth, 0).getDate();
    const endDate = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${lastDay}`;
    
    console.log(`📅 Monthly report: ${startDate} to ${endDate}`);
    
    const totalWorkDays = calculateWorkDays(startDate, endDate);
    
    const query = `
      SELECT 
        w.id,
        w.name,
        w.date_joined,
        w.hourly_rate,
        COUNT(DISTINCT CASE 
          WHEN a.check_in IS NOT NULL THEN a.date 
        END) as days_present,
        COALESCE(SUM(a.total_hours), 0) as total_hours
      FROM workers w
      LEFT JOIN attendance a ON w.id = a.worker_id
        AND a.date >= ?
        AND a.date <= ?
      GROUP BY w.id, w.name, w.date_joined, w.hourly_rate
      ORDER BY w.name
    `;
    
    const rows = db.prepare(query).all(startDate, endDate);
    
    const result = rows.map(row => {
      const joinDate = new Date(row.date_joined);
      const monthStart = new Date(startDate);
      const monthEnd = new Date(endDate);
      
      const startDate_calc = joinDate > monthStart ? joinDate : monthStart;
      const workerWorkDays = calculateWorkDays(startDate_calc.toLocaleDateString('en-CA'), endDate);
      
      // Get advances for this worker
      const advancesQuery = db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM advances WHERE worker_id = ? AND date >= ? AND date <= ?');
      const advancesData = advancesQuery.get(row.id, startDate, endDate);
      const totalAdvances = advancesData.total;
      
      return {
        id: row.id,
        name: row.name,
        hourly_rate: row.hourly_rate,
        days_present: row.days_present || 0,
        days_absent: Math.max(0, workerWorkDays - (row.days_present || 0)),
        total_hours: row.total_hours || 0,
        total_advances: totalAdvances
      };
    });
    
    res.json(result);
  } catch (err) {
    console.error('Monthly report error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============= APIs الإعدادات =============

app.get('/api/settings', (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM settings WHERE id = 1').get();
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/settings/hourly-rate', (req, res) => {
  try {
    const { rate } = req.body;
    db.prepare('UPDATE settings SET hourly_rate = ? WHERE id = 1').run(rate);
    res.json({ success: true, rate });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============= APIs النسخ الاحتياطي =============

app.post('/api/backup/create', (req, res) => {
  const result = backupSystem.createBackup();
  res.json(result);
});

app.get('/api/backup/list', (req, res) => {
  const result = backupSystem.listBackups();
  res.json(result);
});

app.post('/api/backup/restore', (req, res) => {
  const { filename } = req.body;
  const result = backupSystem.restoreBackup(filename);
  res.json(result);
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});