const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

let mainWindow;
let serverProcess;

// Check environment
const isDev = !app.isPackaged;

// إنشاء مجلد البيانات
function ensureUserDataPath() {
  const userDataPath = app.getPath('userData');
  
  // إنشاء مجلد backups
  const backupsPath = path.join(userDataPath, 'backups');
  if (!fs.existsSync(backupsPath)) {
    fs.mkdirSync(backupsPath, { recursive: true });
  }
  
  console.log('✅ User Data Path:', userDataPath);
  console.log('✅ Backups Path:', backupsPath);
  
  return userDataPath;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    icon: path.join(__dirname, '../icon.png'),
    autoHideMenuBar: true,
    title: 'نظام الحضور والانصراف'
  });

  // إخفاء القائمة العلوية
  mainWindow.setMenuBarVisibility(false);

  if (isDev) {
    // Development mode → load Vite server
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // Production mode → load built frontend
    const indexPath = path.join(__dirname, '../frontend/dist/index.html');
    
    console.log('📂 Loading index.html from:', indexPath);
    console.log('📂 File exists?', fs.existsSync(indexPath));
    
    mainWindow.loadFile(indexPath).catch(err => {
      console.error('❌ Failed to load index.html:', err);
    });
    
    // فتح DevTools فقط في حالة حدوث خطأ
    mainWindow.webContents.on('did-fail-load', () => {
      mainWindow.webContents.openDevTools();
    });
  }

  mainWindow.on('closed', function () {
    mainWindow = null;
  });

  // معالجة الأخطاء
  mainWindow.webContents.on('crashed', () => {
    console.error('❌ Window crashed!');
  });

  mainWindow.webContents.on('unresponsive', () => {
    console.error('❌ Window unresponsive!');
  });
}

function startBackendServer() {
  return new Promise((resolve, reject) => {
    const userDataPath = ensureUserDataPath();
    
    let serverPath;
    if (isDev) {
      serverPath = path.join(__dirname, '../backend/server.js');
    } else {
      // في production، الملفات موجودة في resources/app.asar أو resources/app
serverPath = path.join(app.getAppPath(), 'backend/server.js');
      
      // إذا لم يكن موجود، جرب مسار آخر
      if (!fs.existsSync(serverPath)) {
        serverPath = path.join(__dirname, '../backend/server.js');
      }
    }
    
    console.log('🚀 Starting backend server...');
    console.log('📂 Server path:', serverPath);
    console.log('📂 Server exists?', fs.existsSync(serverPath));
    
    // تحديد منفذ ديناميكي (للتأكد من عدم التعارض)
    const PORT = 3001;
    
    serverProcess = spawn('node', [serverPath], {
      stdio: ['ignore', 'pipe', 'pipe'], // تغيير من inherit لـ pipe
      env: { 
        ...process.env, 
        NODE_ENV: isDev ? 'development' : 'production',
        USER_DATA_PATH: userDataPath,
        PORT: PORT
      }
    });

    let serverStarted = false;

    serverProcess.stdout?.on('data', (data) => {
      const message = data.toString();
      console.log('[SERVER]', message);
      
      if (message.includes('Server running') && !serverStarted) {
        serverStarted = true;
        console.log('✅ Backend server started successfully!');
        resolve();
      }
    });

    serverProcess.stderr?.on('data', (data) => {
      console.error('[SERVER ERROR]', data.toString());
    });

    serverProcess.on('error', (err) => {
      console.error('❌ Failed to start server:', err);
      reject(err);
    });

    serverProcess.on('exit', (code) => {
      console.log(`❌ Server exited with code ${code}`);
    });

    // Fallback - إذا لم يبدأ السيرفر خلال 5 ثواني، نفترض أنه بدأ
    setTimeout(() => {
  if (!serverStarted) {
    reject(new Error('Backend failed to start'));
  }
}, 5000);

  });
}

app.on('ready', async () => {
  console.log('🚀 App is ready');
  console.log('📦 Is packaged?', app.isPackaged);
  console.log('📂 App path:', app.getAppPath());
  console.log('📂 Resources path:', process.resourcesPath);
  console.log('📂 User data path:', app.getPath('userData'));
  
  try {
    await startBackendServer();
    createWindow();
  } catch (error) {
    console.error('❌ Failed to start app:', error);
    app.quit();
  }
});

app.on('window-all-closed', function () {
  if (serverProcess) {
    console.log('🛑 Killing server process...');
    serverProcess.kill('SIGTERM');
    
    // إجبار القتل بعد 2 ثانية
    setTimeout(() => {
      if (serverProcess && !serverProcess.killed) {
        serverProcess.kill('SIGKILL');
      }
    }, 2000);
  }
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', function () {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on('quit', () => {
  if (serverProcess) {
    console.log('🛑 Quitting - killing server...');
    serverProcess.kill('SIGKILL');
  }
});

// معالجة الأخطاء غير المتوقعة
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});