const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

let mainWindow;
let serverProcess;

// Check environment
const isDev = !app.isPackaged;

// إنشاء مجلد البيانات والتأكد من المسارات
function ensureUserDataPath() {
  const userDataPath = app.getPath('userData');
  
  // إنشاء مجلد backups
  const backupsPath = path.join(userDataPath, 'backups');
  if (!fs.existsSync(backupsPath)) {
    fs.mkdirSync(backupsPath, { recursive: true });
  }
  
  console.log('✅ User Data Path:', userDataPath);
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
    // المسار الصحيح للأيقونة في الإنتاج والتطوير
    icon: isDev 
      ? path.join(__dirname, '../icon.png') 
      : path.join(process.resourcesPath, 'icon.ico'),
    autoHideMenuBar: true,
    title: 'نظام الحضور والانصراف'
  });

  mainWindow.setMenuBarVisibility(false);

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    /**
     * تصحيح مسار تحميل الواجهة الأمامية:
     * app.getAppPath() يشير إلى جذر ملف asar.
     */
    const indexPath = path.join(app.getAppPath(), 'frontend/dist/index.html');
    
    console.log('📂 Loading index.html from:', indexPath);
    
    mainWindow.loadFile(indexPath).catch(err => {
      console.error('❌ Failed to load index.html:', err);
      // فتح أدوات المطور تلقائياً في حال فشل التحميل لرؤية الخطأ
      mainWindow.webContents.openDevTools();
    });
  }

  mainWindow.on('closed', function () {
    mainWindow = null;
  });

  mainWindow.webContents.on('crashed', () => {
    console.error('❌ Window crashed!');
  });
}

function startBackendServer() {
  return new Promise((resolve, reject) => {
    const userDataPath = ensureUserDataPath();
    
    let serverPath;
    if (isDev) {
      console.log("⚠️ Dev mode: backend is already running via concurrently.");
      return resolve();
    } else {
      /**
       * مسار الإنتاج:
       * نستخدم app.asar.unpacked لأننا قمنا بإلغاء ضغط مجلد backend في package.json
       */
      serverPath = path.join(process.resourcesPath, 'app.asar.unpacked/backend/server.js');
      
      if (!fs.existsSync(serverPath)) {
        serverPath = path.join(app.getAppPath(), 'backend/server.js');
      }
    }
    
    console.log('🚀 Starting backend server...');
    console.log('📂 Server path:', serverPath);
    
    const PORT = 3001;
    
    /**
     * تشغيل السيرفر باستخدام Electron نفسه كمحرك Node
     */
    serverProcess = spawn(process.execPath, [serverPath], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { 
        ...process.env, 
        NODE_ENV: 'production',
        USER_DATA_PATH: userDataPath,
        ELECTRON_RUN_AS_NODE: '1', 
        PORT: PORT
      }
    });

    let serverStarted = false;

    serverProcess.stdout?.on('data', (data) => {
      const message = data.toString();
      if (message.includes('Server running') || message.includes('3001')) {
        serverStarted = true;
        console.log('✅ Backend server is LIVE');
        resolve();
      }
    });

    serverProcess.stderr?.on('data', (data) => {
      const errorMsg = data.toString();
      console.error('[SERVER ERROR]:', errorMsg);
      // عرض خطأ السيرفر في كونسول الواجهة الأمامية للمساعدة في التصحيح
      mainWindow?.webContents.executeJavaScript(`console.error("Backend Error: ${errorMsg.replace(/"/g, '\\"')}")`);
    });

    serverProcess.on('error', (err) => {
      console.error('❌ Failed to spawn backend:', err);
      reject(err);
    });

    setTimeout(() => {
      if (!serverStarted) {
        console.log('⚠️ Server start timeout - proceeding...');
        resolve();
      }
    }, 7000);
  });
}

// الأحداث الأساسية للتطبيق
app.on('ready', async () => {
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
    serverProcess.kill('SIGTERM');
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('quit', () => {
  if (serverProcess) {
    serverProcess.kill('SIGKILL');
  }
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
});