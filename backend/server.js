const express = require('express');
const cors = require('cors');
const db = require('./db');
const BackupSystem = require('./backup');

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
      SELECT 
        w.name, 
        w.hourly_rate, 
        w.job_title,
        a.check_in, 
        a.check_out, 
        a.total_hours,
        COALESCE(SUM(adv.amount), 0) as advances
      FROM attendance a
      JOIN workers w ON a.worker_id = w.id
      LEFT JOIN advances adv ON w.id = adv.worker_id AND adv.date = a.date
      WHERE a.date = ?
      GROUP BY w.id, w.name, w.hourly_rate, w.job_title, a.check_in, a.check_out, a.total_hours
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
    
    const query = `
      SELECT 
        w.name,
        w.hourly_rate,
        w.job_title,
        COUNT(DISTINCT CASE 
          WHEN a.check_in IS NOT NULL THEN a.date 
        END) as days_present,
        COALESCE(SUM(a.total_hours), 0) as total_hours,
        COALESCE(SUM(adv.amount), 0) as advances
      FROM workers w
      LEFT JOIN attendance a ON w.id = a.worker_id
        AND a.date >= ?
        AND a.date <= ?
      LEFT JOIN advances adv ON w.id = adv.worker_id 
        AND adv.date >= ?
        AND adv.date <= ?
      GROUP BY w.id, w.name, w.hourly_rate, w.job_title
      ORDER BY w.name
    `;
    
    const rows = db.prepare(query).all(startDateStr, endDateStr, startDateStr, endDateStr);
    
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
    
    const getWorkDaysInMonth = (year, month, joinDate) => {
      const firstDay = new Date(year, month - 1, 1);
      const lastDay = new Date(year, month, 0);
      const workerJoinDate = new Date(joinDate);
      
      const startDate = workerJoinDate > firstDay ? workerJoinDate : firstDay;
      let workDays = 0;
      
      for (let d = new Date(startDate); d <= lastDay; d.setDate(d.getDate() + 1)) {
        const dayOfWeek = d.getDay();
        if (dayOfWeek !== 5) { // Exclude Fridays (5 = Friday)
          workDays++;
        }
      }
      return workDays;
    };
    
    const query = `
      SELECT 
        w.id,
        w.name,
        w.date_joined,
        w.hourly_rate,
        w.job_title,
        COUNT(DISTINCT CASE 
          WHEN a.check_in IS NOT NULL THEN a.date 
        END) as days_present,
        COALESCE(SUM(a.total_hours), 0) as total_hours,
        COALESCE(SUM(adv.amount), 0) as advances
      FROM workers w
      LEFT JOIN attendance a ON w.id = a.worker_id
        AND a.date >= ?
        AND a.date <= ?
      LEFT JOIN advances adv ON w.id = adv.worker_id 
        AND adv.date >= ?
        AND adv.date <= ?
      GROUP BY w.id, w.name, w.date_joined, w.hourly_rate, w.job_title
      ORDER BY w.name
    `;
    
    const rows = db.prepare(query).all(startDate, endDate, startDate, endDate);
    
    const result = rows.map(row => {
      const workerWorkDays = getWorkDaysInMonth(targetYear, targetMonth, row.date_joined);
      
      return {
        id: row.id,
        name: row.name,
        hourly_rate: row.hourly_rate,
        job_title: row.job_title,
        days_present: row.days_present || 0,
        days_absent: Math.max(0, workerWorkDays - (row.days_present || 0)),
        total_hours: row.total_hours || 0,
        advances: row.advances || 0
      };
    });
    
    res.json(result);
  } catch (err) {
    console.error('Monthly report error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============= APIs السلفة (Advances) =============

app.get('/api/advances/:workerId', (req, res) => {
  try {
    const advances = db.prepare('SELECT * FROM advances WHERE worker_id = ? ORDER BY date DESC').all(req.params.workerId);
    res.json(advances);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/advances', (req, res) => {
  try {
    const { worker_id, amount, date, notes } = req.body;
    const stmt = db.prepare('INSERT INTO advances (worker_id, amount, date, notes) VALUES (?, ?, ?, ?)');
    const result = stmt.run(worker_id, amount, date, notes || null);
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/advances/total/:workerId', (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const query = `
      SELECT COALESCE(SUM(amount), 0) as total
      FROM advances
      WHERE worker_id = ? AND date >= ? AND date <= ?
    `;
    const result = db.prepare(query).get(req.params.workerId, startDate, endDate);
    res.json({ total: result.total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============= APIs السواقين والرحلات =============

app.get('/api/drivers', (req, res) => {
  try {
    const drivers = db.prepare('SELECT * FROM drivers ORDER BY name').all();
    res.json(drivers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/drivers', (req, res) => {
  try {
    const { name, phone, license_number } = req.body;
    const stmt = db.prepare('INSERT INTO drivers (name, phone, license_number) VALUES (?, ?, ?)');
    const result = stmt.run(name, phone, license_number || null);
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/trips/:driverId', (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const query = `
      SELECT * FROM trips
      WHERE driver_id = ? AND date >= ? AND date <= ?
      ORDER BY date DESC, created_at DESC
    `;
    const trips = db.prepare(query).all(req.params.driverId, startDate || '2000-01-01', endDate || '2099-12-31');
    res.json(trips);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/trips', (req, res) => {
  try {
    const { driver_id, from_location, to_location, date, notes } = req.body;
    const stmt = db.prepare('INSERT INTO trips (driver_id, from_location, to_location, date, notes) VALUES (?, ?, ?, ?, ?)');
    const result = stmt.run(driver_id, from_location, to_location, date, notes || null);
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/trips/:id/time', (req, res) => {
  try {
    const { type, time } = req.body;
    const column = type === 'start' ? 'start_time' : 'end_time';
    const stmt = db.prepare(`UPDATE trips SET ${column} = ? WHERE id = ?`);
    stmt.run(time, req.params.id);
    res.json({ success: true });
  } catch (err) {
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

app.put('/api/settings', (req, res) => {
  try {
    const { company_name, company_logo } = req.body;
    db.prepare('UPDATE settings SET company_name = ?, company_logo = ? WHERE id = 1').run(company_name, company_logo);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============= APIs الفواتير =============

app.get('/api/workers/:id/full-report', (req, res) => {
  try {
    const { id } = req.params;
    const { year, month } = req.query;
    
    if (!year || !month) {
      return res.status(400).json({ error: 'يجب تحديد السنة والشهر' });
    }
    
    const worker = db.prepare('SELECT * FROM workers WHERE id = ?').get(id);
    if (!worker) return res.status(404).json({ error: 'Worker not found' });

    // Calculate period
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;

    console.log(`📊 Fetching full report for worker ${id} from ${startDate} to ${endDate}`);

    // Get attendance
    const attendance = db.prepare(`
      SELECT * FROM attendance 
      WHERE worker_id = ? AND date >= ? AND date <= ?
      ORDER BY date
    `).all(id, startDate, endDate);

    // Get advances
    const advances = db.prepare(`
      SELECT * FROM advances 
      WHERE worker_id = ? AND date >= ? AND date <= ?
      ORDER BY date
    `).all(id, startDate, endDate);

    // Calculate totals
    const totalHours = attendance.reduce((sum, row) => {
      const hours = parseFloat(row.total_hours);
      return sum + (isNaN(hours) ? 0 : hours);
    }, 0);
    
    const totalEarned = totalHours * (worker.hourly_rate || 50);
    const totalAdvances = advances.reduce((sum, row) => {
      const amount = parseFloat(row.amount);
      return sum + (isNaN(amount) ? 0 : amount);
    }, 0);
    const netAmount = totalEarned - totalAdvances;

    // Get work days (excluding Fridays)
    const getWorkDaysInMonth = (year, month, joinDate) => {
      const firstDay = new Date(year, month - 1, 1);
      const lastDay = new Date(year, month, 0);
      const workerJoinDate = new Date(joinDate);
      
      const startDate = workerJoinDate > firstDay ? workerJoinDate : firstDay;
      let workDays = 0;
      
      for (let d = new Date(startDate); d <= lastDay; d.setDate(d.getDate() + 1)) {
        const dayOfWeek = d.getDay();
        if (dayOfWeek !== 5) { // Exclude Fridays (5 = Friday)
          workDays++;
        }
      }
      return workDays;
    };

    const workDays = getWorkDaysInMonth(parseInt(year), parseInt(month), worker.date_joined);
    const daysPresent = attendance.filter(a => a.check_in).length;
    const daysAbsent = Math.max(0, workDays - daysPresent);

    res.json({
      worker,
      period: { year, month },
      attendance,
      advances,
      summary: {
        totalHours: totalHours.toFixed(2),
        totalEarned: totalEarned.toFixed(2),
        totalAdvances: totalAdvances.toFixed(2),
        netAmount: netAmount.toFixed(2),
        daysPresent,
        daysAbsent,
        workDays
      }
    });
  } catch (err) {
    console.error('Full report error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Company invoice API
app.get('/api/invoice/company', (req, res) => {
  try {
    const { year, month, date, type } = req.query;
    
    let startDate, endDate;
    
    if (type === 'daily') {
      if (!date) {
        return res.status(400).json({ error: 'يجب تحديد التاريخ للتقرير اليومي' });
      }
      startDate = date;
      endDate = date;
    } else if (type === 'weekly') {
      if (!date) {
        return res.status(400).json({ error: 'يجب تحديد تاريخ نهاية الأسبوع' });
      }
      const weekEnd = new Date(date);
      const weekStart = new Date(weekEnd);
      weekStart.setDate(weekStart.getDate() - 6);
      startDate = weekStart.toLocaleDateString('en-CA');
      endDate = date;
    } else if (type === 'monthly') {
      if (!year || !month) {
        return res.status(400).json({ error: 'يجب تحديد السنة والشهر للتقرير الشهري' });
      }
      startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
      endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;
    } else if (type === 'yearly') {
      if (!year) {
        return res.status(400).json({ error: 'يجب تحديد السنة للتقرير السنوي' });
      }
      // FIXED: Proper yearly data calculation
      startDate = `${year}-01-01`;
      endDate = `${year}-12-31`;
      console.log(`📅 Yearly report from ${startDate} to ${endDate}`);
    } else {
      // Default to monthly if type not specified
      if (!year || !month) {
        const now = new Date();
        year = now.getFullYear();
        month = now.getMonth() + 1;
      }
      startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
      endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;
    }

    console.log(`📊 Generating ${type || 'monthly'} invoice from ${startDate} to ${endDate}`);

    // Get all workers with their attendance and advances for the period
    const workers = db.prepare('SELECT * FROM workers ORDER BY name').all();
    
    const result = [];
    let totalHours = 0;
    let totalEarned = 0;
    let totalAdvances = 0;
    let workersWithActivity = 0;
    
    for (const worker of workers) {
      // Get attendance for this worker in the period
      const attendance = db.prepare(`
        SELECT * FROM attendance 
        WHERE worker_id = ? AND date >= ? AND date <= ?
      `).all(worker.id, startDate, endDate);

      // Get advances for this worker in the period
      const advances = db.prepare(`
        SELECT * FROM advances 
        WHERE worker_id = ? AND date >= ? AND date <= ?
      `).all(worker.id, startDate, endDate);

      // Calculate totals for this worker
      const hours = attendance.reduce((sum, row) => {
        const h = parseFloat(row.total_hours);
        return sum + (isNaN(h) ? 0 : h);
      }, 0);
      
      const earned = hours * (worker.hourly_rate || 50);
      
      const advancesTotal = advances.reduce((sum, row) => {
        const a = parseFloat(row.amount);
        return sum + (isNaN(a) ? 0 : a);
      }, 0);
      
      const netAmount = earned - advancesTotal;

      // Add to company totals
      totalHours += hours;
      totalEarned += earned;
      totalAdvances += advancesTotal;

      // Only include workers with activity in the period
      if (hours > 0 || advancesTotal > 0) {
        workersWithActivity++;
        result.push({
          id: worker.id,
          name: worker.name,
          job_title: worker.job_title,
          hourly_rate: worker.hourly_rate,
          total_hours: hours.toFixed(2),
          earned: earned.toFixed(2),
          advances: advancesTotal.toFixed(2),
          net_amount: netAmount.toFixed(2),
          attendance_count: attendance.length,
          advances_count: advances.length
        });
      }
    }

    const totalNet = totalEarned - totalAdvances;

    // Format period text in Arabic
    let periodText = '';
    if (type === 'daily') {
      periodText = new Date(date).toLocaleDateString('ar-EG', { 
        day: 'numeric', month: 'long', year: 'numeric' 
      });
    } else if (type === 'weekly') {
      const weekEnd = new Date(endDate);
      const weekStart = new Date(startDate);
      periodText = `${weekStart.toLocaleDateString('ar-EG', { day: 'numeric', month: 'long' })} إلى ${weekEnd.toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' })}`;
    } else if (type === 'monthly') {
      const months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 
                      'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
      periodText = `${months[parseInt(month) - 1]} ${year}`;
    } else if (type === 'yearly') {
      periodText = `عام ${year}`;
    } else {
      periodText = `${month}/${year}`;
    }

    console.log(`✅ Found ${workersWithActivity} workers with activity out of ${workers.length} total workers`);
    console.log(`📊 Total Hours: ${totalHours.toFixed(2)}, Total Earned: ${totalEarned.toFixed(2)}, Total Net: ${totalNet.toFixed(2)}`);

    res.json({
      period: periodText,
      type: type || 'monthly',
      startDate,
      endDate,
      workers: result,
      totalHours: totalHours.toFixed(2),
      totalEarned: totalEarned.toFixed(2),
      totalAdvances: totalAdvances.toFixed(2),
      totalNet: totalNet.toFixed(2),
      workersCount: workers.length,
      activeWorkersCount: workersWithActivity,
      settings: db.prepare('SELECT * FROM settings WHERE id = 1').get()
    });
  } catch (err) {
    console.error('❌ Company invoice error:', err);
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

// ============= API الصحة =============
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    database: 'connected'
  });
});

// ============= API التنظيف =============
app.post('/api/cleanup/old-data', (req, res) => {
  try {
    const { days } = req.body;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - (days || 365));
    const cutoffStr = cutoffDate.toLocaleDateString('en-CA');
    
    // Delete old attendance records
    const attendanceResult = db.prepare('DELETE FROM attendance WHERE date < ?').run(cutoffStr);
    
    // Delete old advances records
    const advancesResult = db.prepare('DELETE FROM advances WHERE date < ?').run(cutoffStr);
    
    // Delete old trips records
    const tripsResult = db.prepare('DELETE FROM trips WHERE date < ?').run(cutoffStr);
    
    res.json({
      success: true,
      deleted: {
        attendance: attendanceResult.changes,
        advances: advancesResult.changes,
        trips: tripsResult.changes
      },
      message: `تم حذف البيانات القديمة قبل ${cutoffStr}`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============= API تصدير البيانات =============
app.get('/api/export/data', (req, res) => {
  try {
    const { type } = req.query;
    
    let data = {};
    
    if (!type || type === 'all') {
      data.workers = db.prepare('SELECT * FROM workers').all();
      data.attendance = db.prepare('SELECT * FROM attendance').all();
      data.advances = db.prepare('SELECT * FROM advances').all();
      data.drivers = db.prepare('SELECT * FROM drivers').all();
      data.trips = db.prepare('SELECT * FROM trips').all();
      data.settings = db.prepare('SELECT * FROM settings').all();
    } else if (type === 'workers') {
      data = db.prepare('SELECT * FROM workers').all();
    } else if (type === 'attendance') {
      data = db.prepare('SELECT * FROM attendance').all();
    } else if (type === 'advances') {
      data = db.prepare('SELECT * FROM advances').all();
    }
    
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`📊 Database connected successfully`);
  console.log(`📅 Today's date: ${new Date().toLocaleDateString('en-CA')}`);
  console.log(`🔧 Available endpoints:`);
  console.log(`   GET  /api/health - Check server health`);
  console.log(`   GET  /api/workers - List all workers`);
  console.log(`   GET  /api/invoice/company - Company invoice (with type parameter)`);
  console.log(`   GET  /api/reports/daily/:date - Daily report`);
  console.log(`   GET  /api/reports/monthly - Monthly report`);
  console.log(`   POST /api/backup/create - Create backup`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 Received SIGINT, shutting down gracefully...');
  process.exit(0);
});