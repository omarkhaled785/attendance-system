const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let serverProcess;

// Check environment
const isDev = !app.isPackaged;

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

  if (isDev) {
    // Development mode → load Vite server
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // Production mode → load built frontend
    mainWindow.loadFile(
      path.join(__dirname, '../frontend/dist/index.html')
    );
      mainWindow.webContents.openDevTools(); // <-- Add this
  }

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

function startBackendServer() {
  return new Promise((resolve, reject) => {
    const serverPath = path.join(__dirname, '../backend/server.js');

    serverProcess = spawn('node', [serverPath], {
      stdio: 'inherit',
      env: { 
        ...process.env, 
        NODE_ENV: isDev ? 'development' : 'production',
        USER_DATA_PATH: app.getPath('userData')
      }
    });

    serverProcess.on('error', reject);

    // انتظر السيرفر يطبع رسالة التشغيل
    serverProcess.stdout?.on('data', (data) => {
      if (data.toString().includes('Server running')) {
        resolve();
      }
    });

    // fallback أمان
    setTimeout(resolve, 4000);
  });
}

app.on('ready', async () => {
  await startBackendServer();
  createWindow();
});

app.on('window-all-closed', function () {
  if (serverProcess) {
    serverProcess.kill();
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
    serverProcess.kill();
  }
});
