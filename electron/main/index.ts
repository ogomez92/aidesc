import { nativeImage, screen, globalShortcut, clipboard, app, BrowserWindow, shell, ipcMain, dialog } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'fs';
import { desktopCapturer } from 'electron';
const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '../..')

export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')
export const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST

if (process.platform === 'win32') app.setAppUserModelId(app.getName())

if (!app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

let win: BrowserWindow | null = null
const preload = path.join(__dirname, '../preload/index.mjs')
const indexHtml = path.join(RENDERER_DIST, 'index.html')

async function createWindow() {
  win = new BrowserWindow({
    title: 'Main window',
    icon: path.join(process.env.VITE_PUBLIC, 'favicon.ico'),
    webPreferences: {
      preload,
      nodeIntegration: true,

      contextIsolation: false,
    },
  })

  // Remove the default menu
  win.removeMenu();

  if (VITE_DEV_SERVER_URL) {
    win.webContents.openDevTools()
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(indexHtml)
  }

  win.webContents.on('did-finish-load', () => {
    globalShortcut.register('CommandOrControl+Shift+S', () => {
      // Send a message to the renderer process
      if (win) {
        win.webContents.send('global-shortcut', 'continuousScreenshot');
      }
    });
  })

  // Make all links open with the browser, not with the application
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:')) shell.openExternal(url)
    return { action: 'deny' }
  })
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  win = null
  if (process.platform !== 'darwin') app.quit()
})

app.on('second-instance', () => {
  if (win) {
    // Focus on the main window if the user tried to open another
    if (win.isMinimized()) win.restore()
    win.focus()
  }
})

app.on('activate', () => {
  const allWindows = BrowserWindow.getAllWindows()
  if (allWindows.length) {
    allWindows[0].focus()
  } else {
    createWindow()
  }
})

// New window example arg: new windows url
ipcMain.handle('open-win', (_, arg) => {
  const childWindow = new BrowserWindow({
    webPreferences: {
      preload,
      nodeIntegration: true,
      contextIsolation: false,
    },
  })

  if (VITE_DEV_SERVER_URL) {
    childWindow.loadURL(`${VITE_DEV_SERVER_URL}#${arg}`)
  } else {
    childWindow.loadFile(indexHtml, { hash: arg })
  }
})

ipcMain.handle('set-clipboard', (_, text) => {
  if (typeof text === 'string') {
    clipboard.writeText(text)
  } else {
    throw new Error('Clipboard text must be a string')
  }
});

ipcMain.handle('dialog:openFile', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'All Files', extensions: ['*'] }
    ]
  })
  if (!canceled && filePaths.length > 0) {
    return filePaths[0] // Return the first selected file path
  }
  return null
})

ipcMain.handle('get-capture-sources', async () => {
  const sources = await desktopCapturer.getSources({ types: ['screen', 'window'] });

  return sources;
});

ipcMain.handle('get-temp-path', () => {
  return app.getPath('temp');
});

ipcMain.handle('capture-screen', async (event, sourceId) => {
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width, height } = primaryDisplay.workAreaSize

  const sources = await desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: { width: width, height: height } });
  const source = sources.find(s => s.id === sourceId);

  if (!source) throw new Error('Source not found');

  const screenshotPath = path.join(app.getPath('temp'), 'screenshot.png');
  fs.writeFileSync(screenshotPath, source.thumbnail.toPNG());

  // Compress image
  const image = nativeImage.createFromPath(screenshotPath);
  const compressedImage = image.resize({ width: width*0.75, height: height*0.75 }).toPNG({ scaleFactor: 0.8 });
  fs.writeFileSync(screenshotPath, compressedImage);
  return screenshotPath;
});

// Handle File Save Dialog
ipcMain.handle('dialog:saveFile', async (event, defaultPath) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    defaultPath: defaultPath || '',
    filters: [
      { name: 'Video Files', extensions: ['mp4', 'avi', 'mkv', 'mov'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  })
  if (!canceled && filePath) {
    return filePath
  }
  return null
})


app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});