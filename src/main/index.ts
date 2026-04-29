import { app, BrowserWindow } from 'electron';
import { join } from 'node:path';

function createWindow(): BrowserWindow {
  const tool = process.env.ISOGAME_TOOL === 'editor' ? 'editor' : 'game';
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: tool === 'editor' ? '#141616' : '#111821',
    title: tool === 'editor' ? 'IsoGame Map Editor' : 'IsoGame Prototype',
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      sandbox: false
    }
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    const entryUrl =
      tool === 'editor'
        ? new URL('editor.html', process.env.ELECTRON_RENDERER_URL).toString()
        : process.env.ELECTRON_RENDERER_URL;
    void window.loadURL(entryUrl);
  } else {
    void window.loadFile(join(__dirname, `../renderer/${tool === 'editor' ? 'editor' : 'index'}.html`));
  }

  return window;
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
