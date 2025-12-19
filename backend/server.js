const express = require('express');
const cors = require('cors');
const db = require('./db');
const BackupSystem = require('./backup');

const app = express();
const PORT = 3001;

// تفعيل النسخ الاحتياطي التلقائي
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

app.post('/api/workers', (req, res) => {
  try {
    const { name, age, phone, national_id, date_joined, photo } = req.body;
    const stmt = db.prepare(`
      INSERT INTO workers (name, age, phone, national_id, date_joined, photo) 
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(name, age, phone, national_id, date_joined, photo);
    res.json({ id: result.lastInsertRowid, name, age, phone, national_id, date_joined, photo });
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

app.delete('/api/workers/:id', (req, res) => {
  try {
    const stmt = db.prepare('DELETE FROM workers WHERE id = ?');
    const result = stmt.run(req.params.id);
    res.json({ deleted: result.changes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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

// ============= APIs الحضور =============

app.get('/api/attendance/today', (req, res) => {
  try {
    const today = new Date().toLocaleDateString('en-CA');
    const query = `
      SELECT w.id, w.name, a.check_in, a.lunch_out, a.lunch_in, a.check_out, a.total_hours
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

// Replace the attendance record endpoint in server.js
// Find app.post('/api/attendance/record', ...) and replace it

app.post('/api/attendance/record', (req, res) => {
  try {
    const { workerId, type } = req.body;
    const today = new Date().toLocaleDateString('en-CA');
    const now = new Date().toTimeString().split(' ')[0];
    
    const row = db.prepare('SELECT * FROM attendance WHERE worker_id = ? AND date = ?').get(workerId, today);
    
    // If no record exists
    if (!row) {
      if (type !== 'check_in') {
        return res.status(400).json({ error: 'يجب تسجيل الحضور أولاً' });
      }
      db.prepare('INSERT INTO attendance (worker_id, date, check_in) VALUES (?, ?, ?)').run(workerId, today, now);
      return res.json({ success: true, time: now });
    }
    
    // ===== VALIDATION CHECKS =====
    
    // Check-in validation
    if (type === 'check_in') {
      // Already checked in
      if (row.check_in) {
        return res.status(400).json({ error: 'تم تسجيل الحضور بالفعل' });
      }
    }
    
    // Lunch-out validation
    if (type === 'lunch_out') {
      if (!row.check_in) {
        return res.status(400).json({ error: 'يجب تسجيل الحضور أولاً' });
      }
      if (row.check_out) {
        return res.status(400).json({ error: 'العامل غادر بالفعل - السجل مغلق' });
      }
      if (row.lunch_out) {
        return res.status(400).json({ error: 'تم تسجيل خروج الغدا بالفعل' });
      }
    }
    
    // Lunch-in validation
    if (type === 'lunch_in') {
      if (!row.lunch_out) {
        return res.status(400).json({ error: 'يجب تسجيل خروج الغدا أولاً' });
      }
      if (row.check_out) {
        return res.status(400).json({ error: 'العامل غادر بالفعل - السجل مغلق' });
      }
      if (row.lunch_in) {
        return res.status(400).json({ error: 'تم تسجيل العودة من الغدا بالفعل' });
      }
    }
    
    // Check-out validation - FIXED LOGIC
    if (type === 'check_out') {
      if (!row.check_in) {
        return res.status(400).json({ error: 'يجب تسجيل الحضور أولاً' });
      }
      
      // FIXED: Only require lunch_in if lunch_out was recorded
      if (row.lunch_out && !row.lunch_in) {
        return res.status(400).json({ error: 'يجب تسجيل العودة من الغدا أولاً' });
      }
      
      if (row.check_out) {
        return res.status(400).json({ error: 'تم تسجيل الانصراف بالفعل' });
      }
    }
    
    // ===== PERFORM THE ACTION =====
    
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
      SELECT w.name, a.check_in, a.check_out, a.total_hours
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

// Replace the weekly report endpoint in server.js

app.get('/api/reports/weekly', (req, res) => {
  try {
    const { date } = req.query; // Target date (end of week)
    const targetDate = date ? new Date(date) : new Date();
    
    // Calculate week start (7 days BEFORE the target date, inclusive)
    const weekStart = new Date(targetDate);
    weekStart.setDate(weekStart.getDate() - 6); // Go back 6 days (so total is 7 days including target)
    
    const startDateStr = weekStart.toLocaleDateString('en-CA');
    const endDateStr = targetDate.toLocaleDateString('en-CA');
    
    console.log(`📅 Weekly report: ${startDateStr} to ${endDateStr}`);
    
    const query = `
      SELECT 
        w.name,
        COUNT(DISTINCT CASE 
          WHEN a.check_in IS NOT NULL THEN a.date 
        END) as days_present,
        COALESCE(SUM(a.total_hours), 0) as total_hours
      FROM workers w
      LEFT JOIN attendance a ON w.id = a.worker_id
        AND a.date >= ?
        AND a.date <= ?
      GROUP BY w.id, w.name
      ORDER BY w.name
    `;
    
    const rows = db.prepare(query).all(startDateStr, endDateStr);
    
    res.json(rows);
  } catch (err) {
    console.error('Weekly report error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ========================================
// REPLACE IN server.js - Monthly Report
// ========================================

app.get('/api/reports/monthly', (req, res) => {
  try {
    const { year, month } = req.query;
    const targetYear = year ? parseInt(year) : new Date().getFullYear();
    const targetMonth = month ? parseInt(month) : new Date().getMonth() + 1;
    
    const startDate = `${targetYear}-${String(targetMonth).padStart(2, '0')}-01`;
    const lastDay = new Date(targetYear, targetMonth, 0).getDate();
    const endDate = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${lastDay}`;
    
    console.log(`📅 Monthly report: ${startDate} to ${endDate}`);
    
    // Calculate work days in the selected month (excluding ONLY Friday)
    const getWorkDaysInMonth = (year, month) => {
      const firstDay = new Date(year, month - 1, 1);
      const lastDay = new Date(year, month, 0);
      let workDays = 0;
      
      for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
        const dayOfWeek = d.getDay();
        // 5 = Friday (holiday)
        // All other days (0-4, 6) are work days
        if (dayOfWeek !== 5) {
          workDays++;
        }
      }
      return workDays;
    };
    
    const totalWorkDays = getWorkDaysInMonth(targetYear, targetMonth);
    
    const query = `
      SELECT 
        w.name,
        w.date_joined,
        COUNT(DISTINCT CASE 
          WHEN a.check_in IS NOT NULL THEN a.date 
        END) as days_present,
        COALESCE(SUM(a.total_hours), 0) as total_hours
      FROM workers w
      LEFT JOIN attendance a ON w.id = a.worker_id
        AND a.date >= ?
        AND a.date <= ?
      GROUP BY w.id, w.name, w.date_joined
      ORDER BY w.name
    `;
    
    const rows = db.prepare(query).all(startDate, endDate);
    
    // Calculate absence days based on hire date
    const result = rows.map(row => {
      const joinDate = new Date(row.date_joined);
      const monthStart = new Date(startDate);
      const monthEnd = new Date(endDate);
      
      // If hired after month start, calculate from hire date
      const startDate_calc = joinDate > monthStart ? joinDate : monthStart;
      
      let workerWorkDays = 0;
      for (let d = new Date(startDate_calc); d <= monthEnd; d.setDate(d.getDate() + 1)) {
        const dayOfWeek = d.getDay();
        // Exclude ONLY Friday (5)
        if (dayOfWeek !== 5) {
          workerWorkDays++;
        }
      }
      
      return {
        name: row.name,
        days_present: row.days_present || 0,
        days_absent: Math.max(0, workerWorkDays - (row.days_present || 0)),
        total_hours: row.total_hours || 0
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

app.put('/api/settings/password', (req, res) => {
  try {
    const { password } = req.body;
    db.prepare('UPDATE settings SET admin_password = ? WHERE id = 1').run(password);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/login', (req, res) => {
  try {
    const { password } = req.body;
    const row = db.prepare('SELECT admin_password FROM settings WHERE id = 1').get();
    if (row && row.admin_password === password) {
      res.json({ success: true });
    } else {
      res.status(401).json({ success: false, message: 'كلمة مرور خاطئة' });
    }
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