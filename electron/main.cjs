// Desktop shell: starts the Next.js server on a private localhost port and shows it in a window.
const { app, BrowserWindow, shell, dialog, Menu } = require("electron");
const { spawn, execFile } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");

const APP_NAME = "Rapport";
app.setName(APP_NAME);
if (process.platform === "win32") app.setAppUserModelId("com.huntermauro.rapport");

if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

const appDir = app.getAppPath();
const dataDir = path.join(process.env.LOCALAPPDATA || app.getPath("userData"), "Rapport", "data");
fs.mkdirSync(dataDir, { recursive: true });
const logFile = path.join(dataDir, "app.log");

let server = null;
let win = null;
let baseUrl = null;
let quitting = false;

function log(line) {
  try {
    fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${line}\n`);
  } catch {}
}

function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.unref();
    s.on("error", reject);
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });
}

function waitForServer(url, timeoutMs) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve();
      });
      req.on("error", () => {
        if (server && server.exitCode !== null) return reject(new Error("The app server stopped while starting."));
        if (Date.now() - started > timeoutMs) return reject(new Error("The app server took too long to start."));
        setTimeout(tick, 300);
      });
      req.setTimeout(2000, () => req.destroy());
    };
    tick();
  });
}

async function startServer() {
  const port = await freePort();
  const nextBin = path.join(appDir, "node_modules", "next", "dist", "bin", "next");
  log(`Starting server on port ${port} (app dir ${appDir}, data dir ${dataDir})`);
  server = spawn(process.execPath, [nextBin, "start", "-H", "127.0.0.1", "-p", String(port)], {
    cwd: appDir,
    windowsHide: true,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      NODE_ENV: "production",
      NEXT_TELEMETRY_DISABLED: "1",
      CRM_DATA_DIR: dataDir,
      CRM_MIGRATIONS_DIR: path.join(appDir, "drizzle"),
    },
  });
  server.stdout.on("data", (d) => log(String(d).trimEnd()));
  server.stderr.on("data", (d) => log("ERR " + String(d).trimEnd()));
  server.on("exit", (code) => {
    log(`Server exited with code ${code}`);
    if (!quitting) {
      dialog.showErrorBox(APP_NAME, `The app stopped unexpectedly. Details are in:\n${logFile}`);
      app.quit();
    }
  });
  baseUrl = `http://127.0.0.1:${port}`;
  await waitForServer(baseUrl + "/", 90000);
}

function stopServer() {
  if (!server || server.exitCode !== null) return;
  if (process.platform === "win32") execFile("taskkill", ["/pid", String(server.pid), "/T", "/F"], () => {});
  else server.kill();
}

const LOADING_HTML = `data:text/html;charset=utf-8,${encodeURIComponent(`<!doctype html><html><body style="margin:0;height:100vh;display:flex;align-items:center;justify-content:center;background:#08090c;color:#a1a1aa;font:14px system-ui,sans-serif">
<div style="text-align:center"><div style="width:36px;height:36px;margin:0 auto 14px;border-radius:10px;background:linear-gradient(135deg,#8f95ff,#d946ef)"></div>Starting ${APP_NAME}…</div></body></html>`)}`;

function isInternal(url) {
  return baseUrl && url.startsWith(baseUrl);
}

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1000,
    minHeight: 640,
    backgroundColor: "#08090c",
    title: APP_NAME,
    icon: path.join(__dirname, "icon.png"),
    autoHideMenuBar: true,
    show: false,
    webPreferences: { contextIsolation: true, sandbox: true },
  });
  win.once("ready-to-show", () => win.show());

  // Links to websites, tel: and mailto: open outside the app (tel: opens Phone Link or your default calling app).
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!isInternal(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (e, url) => {
    if (!isInternal(url) && !url.startsWith("data:")) {
      e.preventDefault();
      void shell.openExternal(url);
    }
  });
  win.on("closed", () => (win = null));
  return win.loadURL(LOADING_HTML);
}

app.on("second-instance", () => {
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

app.whenReady().then(async () => {
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      { role: "fileMenu" },
      { role: "editMenu" },
      {
        label: "View",
        submenu: [{ role: "reload" }, { role: "toggleDevTools" }, { type: "separator" }, { role: "resetZoom" }, { role: "zoomIn" }, { role: "zoomOut" }, { type: "separator" }, { role: "togglefullscreen" }],
      },
      {
        label: "Help",
        submenu: [
          { label: "Open data folder", click: () => shell.openPath(dataDir) },
          { label: "Open log file", click: () => shell.openPath(logFile) },
        ],
      },
    ]),
  );
  await createWindow();
  try {
    await startServer();
    await win.loadURL(baseUrl + "/");
  } catch (e) {
    log("Startup failed: " + (e && e.stack ? e.stack : e));
    dialog.showErrorBox(APP_NAME, `${e.message}\n\nDetails are in:\n${logFile}`);
    quitting = true;
    stopServer();
    app.quit();
  }
});

app.on("before-quit", () => {
  quitting = true;
  stopServer();
});
app.on("window-all-closed", () => app.quit());
