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
      console.log("⚠️ Dev mode: backend is already running via concurrently.");
      return resolve();
    } else {
      /**
       * In Production:
       * Because we used 'asarUnpack' for the backend folder in package.json,
       * the files are moved to 'app.asar.unpacked'. 
       * SQLite and child_process works much better from here.
       */
      serverPath = path.join(process.resourcesPath, 'app.asar.unpacked/backend/server.js');
      
      // Fallback check if the path above doesn't exist for some reason
      if (!fs.existsSync(serverPath)) {
        serverPath = path.join(app.getAppPath(), 'backend/server.js');
      }
    }
    
    console.log('🚀 Starting backend server...');
    console.log('📂 Server path:', serverPath);
    
    const PORT = 3001;
    
    /**
     * Use process.execPath (the Electron exe itself) to run the script.
     * ELECTRON_RUN_AS_NODE: '1' makes Electron act like a standard Node.js binary.
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
      console.log('[SERVER LOG]:', message);
      
      // Matches the console.log in your server.js
      if (message.includes('Server running') || message.includes('localhost:3001')) {
        serverStarted = true;
        console.log('✅ Backend server is LIVE');
        resolve();
      }
    });

    serverProcess.stderr?.on('data', (data) => {
      const errorMsg = data.toString();
      console.error('[SERVER ERROR]:', errorMsg);
      
      // If the database fails to load, we want to know immediately
      if (errorMsg.includes('Error')) {
        mainWindow?.webContents.executeJavaScript(`console.error("Backend Error: ${errorMsg.replace(/"/g, '\\"')}")`);
      }
    });

    serverProcess.on('error', (err) => {
      console.error('❌ Failed to spawn backend process:', err);
      reject(err);
    });

    serverProcess.on('exit', (code) => {
      console.log(`❌ Backend server process exited with code ${code}`);
    });

    // Fallback: If no output is detected within 7 seconds, resolve anyway
    setTimeout(() => {
      if (!serverStarted) {
        console.log('⚠️ Server start confirmation timed out, proceeding...');
        resolve();
      }
    }, 7000);
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