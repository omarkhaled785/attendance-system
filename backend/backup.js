const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

class BackupSystem {
  constructor() {
    this.dbPath = path.join(__dirname, '../attendance.db');
    this.backupDir = path.join(__dirname, '../backups');
    
    // إنشاء مجلد النسخ الاحتياطية
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  // نسخة احتياطية يدوية
  createBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(this.backupDir, `backup-${timestamp}.db`);

    try {
      fs.copyFileSync(this.dbPath, backupPath);
      console.log(`✅ تم إنشاء نسخة احتياطية: ${backupPath}`);
      
      // حذف النسخ القديمة (الأقدم من 30 يوم)
      this.cleanOldBackups();
      
      return { success: true, path: backupPath };
    } catch (error) {
      console.error('❌ فشل إنشاء النسخة الاحتياطية:', error);
      return { success: false, error: error.message };
    }
  }

  // نسخ احتياطي تلقائي كل يوم
  startAutoBackup() {
    // نسخة احتياطية عند بدء التشغيل
    this.createBackup();

    // نسخة احتياطية كل 24 ساعة
    setInterval(() => {
      this.createBackup();
    }, 24 * 60 * 60 * 1000); // كل يوم

    console.log('✅ النسخ الاحتياطي التلقائي مفعّل');
  }

  // حذف النسخ الاحتياطية القديمة
  cleanOldBackups() {
    const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 يوم
    const now = Date.now();

    try {
      const files = fs.readdirSync(this.backupDir);
      
      files.forEach(file => {
        const filePath = path.join(this.backupDir, file);
        const stats = fs.statSync(filePath);
        
        if (now - stats.mtimeMs > maxAge) {
          fs.unlinkSync(filePath);
          console.log(`🗑️  تم حذف النسخة القديمة: ${file}`);
        }
      });
    } catch (error) {
      console.error('خطأ في حذف النسخ القديمة:', error);
    }
  }

  // استعادة من نسخة احتياطية
  restoreBackup(backupFileName) {
    const backupPath = path.join(this.backupDir, backupFileName);

    if (!fs.existsSync(backupPath)) {
      return { success: false, error: 'النسخة الاحتياطية غير موجودة' };
    }

    try {
      // نسخة احتياطية من قاعدة البيانات الحالية قبل الاستعادة
      const currentBackup = path.join(this.backupDir, `before-restore-${Date.now()}.db`);
      fs.copyFileSync(this.dbPath, currentBackup);

      // استعادة النسخة الاحتياطية
      fs.copyFileSync(backupPath, this.dbPath);
      
      console.log(`✅ تم استعادة النسخة الاحتياطية: ${backupFileName}`);
      return { success: true };
    } catch (error) {
      console.error('❌ فشل استعادة النسخة الاحتياطية:', error);
      return { success: false, error: error.message };
    }
  }

  // جلب قائمة النسخ الاحتياطية
  listBackups() {
    try {
      const files = fs.readdirSync(this.backupDir);
      const backups = files
        .filter(f => f.endsWith('.db'))
        .map(f => {
          const stats = fs.statSync(path.join(this.backupDir, f));
          return {
            filename: f,
            size: (stats.size / 1024 / 1024).toFixed(2) + ' MB',
            date: stats.mtime
          };
        })
        .sort((a, b) => b.date - a.date);

      return { success: true, backups };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // نسخ احتياطي لـ Google Drive (اختياري)
  async backupToCloud(serviceName = 'google-drive') {
    // يمكن إضافة integration مع Google Drive API
    // أو Dropbox API
    // أو أي cloud storage
    console.log('ميزة النسخ الاحتياطي السحابي قيد التطوير');
  }
}

module.exports = BackupSystem;