const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('path');
const fs = require('fs');

// Tat co bao tu dong hoa de TikTok khong nhan dien bot/trinh duyet la
app.commandLine.appendSwitch('disable-blink-features', 'AutomationControlled');

// Tat log canh bao subframe/network rac vao terminal
app.commandLine.appendSwitch('log-level', '3');

// Bat tang toc phan cung GPU, giup luot trang va cuon muot ma hon
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-accelerated-2d-canvas');
app.commandLine.appendSwitch('enable-accelerated-video-decode');

// Khong bop hieu nang khi chuyen tab / cua so chay ngam
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('enable-smooth-scrolling');

// Gia lap Chrome that de TikTok khong chan trinh duyet "la"
const CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
app.userAgentFallback = CHROME_UA;

const storeFile = () => path.join(app.getPath('userData'), 'shops.json');

function readShops() {
  try {
    return JSON.parse(fs.readFileSync(storeFile(), 'utf8'));
  } catch {
    return [];
  }
}

function writeShops(shops) {
  fs.mkdirSync(path.dirname(storeFile()), { recursive: true });
  fs.writeFileSync(storeFile(), JSON.stringify(shops, null, 2), 'utf8');
}

ipcMain.handle('shops:get', () => readShops());
ipcMain.handle('shops:save', (_e, shops) => {
  writeShops(shops);
  return true;
});
// Dang xuat 1 gian = xoa phien dang nhap cua rieng gian do
ipcMain.handle('shops:clearSession', async (_e, id) => {
  const ses = session.fromPartition('persist:shop-' + id);
  await ses.clearStorageData();
  await ses.clearCache();
  return true;
});

// Toi uu hoa session & chan script theo doi gay lag TikTok Shop
app.on('session-created', (ses) => {
  try {
    ses.setSpellCheckerEnabled(false);
  } catch {}

  // Chan cac request tracking telemetry ngam cua TikTok (giup giam tai CPU & mang dang ke)
  try {
    ses.webRequest.onBeforeRequest(
      {
        urls: [
          '*://*/sgtm/*',
          '*://mon.tiktokv.com/*',
          '*://mcs.tiktok.com/*',
          '*://slardar.tiktokv.com/*',
          '*://*.byteoversea.com/monitor/*',
          '*://*.bytedance.com/monitor/*',
          '*://tea.tiktok.com/*'
        ]
      },
      (details, callback) => {
        callback({ cancel: true });
      }
    );
  } catch {}
});

// Cho phep popup mo trong app va bat buoc dung chung session partition voi shop do
app.on('web-contents-created', (_e, contents) => {
  contents.setUserAgent(CHROME_UA);

  // Xu ly zoom bang Ctrl +, Ctrl -, Ctrl 0 ngay ben trong noi dung web
  contents.on('before-input-event', (event, input) => {
    if (input.control && !input.alt && input.type === 'keyDown') {
      if (input.key === '=' || input.key === '+') {
        const z = contents.getZoomFactor();
        contents.setZoomFactor(Math.min(Math.round((z + 0.1) * 10) / 10, 2.5));
        event.preventDefault();
      } else if (input.key === '-') {
        const z = contents.getZoomFactor();
        contents.setZoomFactor(Math.max(Math.round((z - 0.1) * 10) / 10, 0.5));
        event.preventDefault();
      } else if (input.key === '0') {
        contents.setZoomFactor(1.0);
        event.preventDefault();
      }
    }
  });

  // Bo qua cac canh bao tai iframe tracking/subframe bi chan boi may chu
  contents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (!isMainFrame) {
      if (typeof event.preventDefault === 'function') event.preventDefault();
    }
  });

  if (contents.getType() === 'webview') {
    contents.setWindowOpenHandler(() => ({
      action: 'allow',
      overrideBrowserWindowOptions: {
        webPreferences: {
          partition: contents.session.partition
        }
      }
    }));
  }
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1500,
    height: 900,
    title: '186 HOME - TikTok MultiShop',
    icon: path.join(__dirname, 'icon.png'),
    backgroundColor: '#111418',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
      spellcheck: false
    }
  });
  win.setMenuBarVisibility(false);
  win.maximize();
  win.loadFile('index.html');
}

let isQuitting = false;
app.on('before-quit', async (e) => {
  if (!isQuitting) {
    e.preventDefault();
    isQuitting = true;
    const shops = readShops();
    await Promise.all(
      shops.map(async (s) => {
        try {
          const ses = session.fromPartition('persist:shop-' + s.id);
          await ses.cookies.flushStore();
        } catch {}
      })
    );
    app.quit();
  }
});

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
