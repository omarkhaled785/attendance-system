const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../attendance.db');
const db = new Database(dbPath);

console.log('=================================');
console.log('🌱 إضافة 10 عمال ببيانات متنوعة');
console.log('=================================\n');

// أسماء العمال
const workers = [
  { name: 'أحمد محمد علي', age: 28, phone: '01012345671', national_id: '29601011234561', date_joined: '2024-01-15' },
  { name: 'محمود حسن السيد', age: 32, phone: '01023456782', national_id: '29201021234562', date_joined: '2024-02-01' },
  { name: 'خالد عبد الله', age: 25, phone: '01034567893', national_id: '29901031234563', date_joined: '2024-03-10' },
  { name: 'عمر فتحي محمد', age: 30, phone: '01045678904', national_id: '29401041234564', date_joined: '2024-04-05' },
  { name: 'يوسف إبراهيم', age: 27, phone: '01056789015', national_id: '29701051234565', date_joined: '2024-05-20' },
  { name: 'مصطفى سعيد', age: 35, phone: '01067890126', national_id: '29001061234566', date_joined: '2024-06-15' },
  { name: 'طارق رمضان', age: 29, phone: '01078901237', national_id: '29501071234567', date_joined: '2024-07-01' },
  { name: 'كريم أشرف', age: 26, phone: '01089012348', national_id: '29801081234568', date_joined: '2024-08-10' },
  { name: 'حسام الدين', age: 31, phone: '01090123459', national_id: '29301091234569', date_joined: '2024-09-05' },
  { name: 'وليد صلاح', age: 24, phone: '01001234560', national_id: '30001101234570', date_joined: '2024-10-01' }
];

// حذف العمال القدامى
console.log('🗑️  حذف العمال القدامى...');
db.prepare('DELETE FROM workers').run();
db.prepare('DELETE FROM attendance').run();
console.log('✅ تم الحذف\n');

// إضافة العمال الجدد
console.log('👥 إضافة العمال الجدد...');
const insertWorker = db.prepare(`
  INSERT INTO workers (name, age, phone, national_id, date_joined) 
  VALUES (?, ?, ?, ?, ?)
`);

const insertedWorkers = [];
workers.forEach(w => {
  const result = insertWorker.run(w.name, w.age, w.phone, w.national_id, w.date_joined);
  insertedWorkers.push({ ...w, id: result.lastInsertRowid });
  console.log(`   ✅ ${w.name} (ID: ${result.lastInsertRowid})`);
});

console.log('\n📅 إنشاء سجلات حضور متنوعة...\n');

// إنشاء سجلات حضور من تاريخ تعيين كل عامل لحد النهارده
const today = new Date();
const insertAttendance = db.prepare(`
  INSERT INTO attendance (worker_id, date, check_in, lunch_out, lunch_in, check_out, total_hours) 
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const insertMany = db.transaction((records) => {
  for (const record of records) {
    insertAttendance.run(...record);
  }
});

let totalRecords = 0;
const allRecords = [];

insertedWorkers.forEach((worker, workerIndex) => {
  const startDate = new Date(worker.date_joined);
  let workerRecords = 0;
  
  // كل عامل له نسبة حضور مختلفة
  const attendanceRate = 0.65 + (workerIndex * 0.03); // من 65% إلى 92%
  
  // كل عامل له ساعات عمل مختلفة شوية
  const baseWorkHours = 7 + (workerIndex * 0.2); // من 7 لـ 8.8 ساعة
  
  for (let d = new Date(startDate); d <= today; d.setDate(d.getDate() + 1)) {
    const dayOfWeek = d.getDay();
    
    // تخطي الجمعة
    if (dayOfWeek === 5) continue;
    
    const dateStr = d.toISOString().split('T')[0];
    
    // احتمال الحضور يختلف لكل عامل
    const willAttend = Math.random() < attendanceRate;
    
    if (willAttend) {
      // أوقات حضور متنوعة
      const checkInHour = 7 + workerIndex % 3; // 7, 8, أو 9 صباحاً
      const checkInMinute = Math.floor(Math.random() * 60);
      
      // وقت خروج الغدا
      const lunchOutHour = 12 + (workerIndex % 2); // 12 أو 1 ظهراً
      const lunchOutMinute = Math.floor(Math.random() * 30);
      
      // وقت دخول الغدا (بعد ساعة)
      const lunchInHour = lunchOutHour + 1;
      const lunchInMinute = lunchOutMinute + Math.floor(Math.random() * 15);
      
      // وقت انصراف متنوع
      const checkOutHour = 15 + Math.floor(Math.random() * 3); // 3-5 مساءً
      const checkOutMinute = Math.floor(Math.random() * 60);
      
      const checkIn = `${String(checkInHour).padStart(2, '0')}:${String(checkInMinute).padStart(2, '0')}:00`;
      const lunchOut = `${String(lunchOutHour).padStart(2, '0')}:${String(lunchOutMinute).padStart(2, '0')}:00`;
      const lunchIn = `${String(lunchInHour).padStart(2, '0')}:${String(lunchInMinute % 60).padStart(2, '0')}:00`;
      const checkOut = `${String(checkOutHour).padStart(2, '0')}:${String(checkOutMinute).padStart(2, '0')}:00`;
      
      // حساب ساعات العمل (إجمالي - وقت الغدا)
      const totalMinutes = (checkOutHour * 60 + checkOutMinute) - (checkInHour * 60 + checkInMinute);
      const lunchMinutes = 60; // ساعة غدا
      const workMinutes = totalMinutes - lunchMinutes;
      const totalHours = Math.max(0, workMinutes / 60).toFixed(2);
      
      allRecords.push([
        worker.id,
        dateStr,
        checkIn,
        lunchOut,
        lunchIn,
        checkOut,
        totalHours
      ]);
      
      workerRecords++;
    }
  }
  
  console.log(`   📊 ${worker.name}: ${workerRecords} يوم (${(attendanceRate * 100).toFixed(0)}% حضور، ~${baseWorkHours.toFixed(1)} ساعة/يوم)`);
  totalRecords += workerRecords;
});

console.log('\n💾 حفظ البيانات في قاعدة البيانات...');
insertMany(allRecords);

console.log('\n=================================');
console.log(`✅ تم إضافة ${insertedWorkers.length} عامل`);
console.log(`✅ تم إضافة ${totalRecords} سجل حضور`);
console.log('=================================\n');

// عرض إحصائيات تفصيلية
console.log('📊 الإحصائيات التفصيلية:\n');

insertedWorkers.forEach(worker => {
  const stats = db.prepare(`
    SELECT 
      COUNT(*) as total_days,
      SUM(total_hours) as total_hours,
      AVG(total_hours) as avg_hours,
      MIN(date) as first_day,
      MAX(date) as last_day
    FROM attendance 
    WHERE worker_id = ?
  `).get(worker.id);
  
  console.log(`👤 ${worker.name}`);
  console.log(`   📅 من ${worker.date_joined} (${stats.first_day})`);
  console.log(`   📊 ${stats.total_days} يوم حضور`);
  console.log(`   ⏰ ${parseFloat(stats.total_hours).toFixed(2)} ساعة إجمالي`);
  console.log(`   📈 ${parseFloat(stats.avg_hours).toFixed(2)} ساعة متوسط/يوم\n`);
});

// عرض إحصائيات شهرية
console.log('📅 الإحصائيات الشهرية:\n');

const monthlyStats = db.prepare(`
  SELECT 
    strftime('%Y-%m', date) as month,
    COUNT(*) as records,
    SUM(total_hours) as hours,
    COUNT(DISTINCT worker_id) as workers
  FROM attendance
  GROUP BY strftime('%Y-%m', date)
  ORDER BY month DESC
`).all();

monthlyStats.forEach(stat => {
  const monthNames = {
    '01': 'يناير', '02': 'فبراير', '03': 'مارس', '04': 'أبريل',
    '05': 'مايو', '06': 'يونيو', '07': 'يوليو', '08': 'أغسطس',
    '09': 'سبتمبر', '10': 'أكتوبر', '11': 'نوفمبر', '12': 'ديسمبر'
  };
  const [year, month] = stat.month.split('-');
  const monthName = monthNames[month];
  
  console.log(`   📆 ${monthName} ${year}:`);
  console.log(`      ${stat.records} سجل، ${stat.workers} عامل، ${parseFloat(stat.hours).toFixed(2)} ساعة`);
});

console.log('\n=================================');
console.log('🎉 تم بنجاح! جاهز للاختبار');
console.log('=================================');
console.log('\n💡 جرب الآن:');
console.log('   1. افتح التقارير الشهرية واختر شهور مختلفة');
console.log('   2. اضغط على أسماء العمال لرؤية تفاصيلهم');
console.log('   3. لاحظ الفرق في نسب الحضور وساعات العمل\n');

db.close();