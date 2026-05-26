import {
  Tray,
  BrowserWindow,
  nativeImage,
  Notification,
  app,
  ipcMain,
  screen,
} from "electron";
import { readFileSync } from "fs";
import { join as pathJoin } from "path";
import { is } from "@electron-toolkit/utils";
import { openExternalSafely } from "./external-url";
import { loadRuntimeConfig } from "./runtime-config-loader";
import { getAppVersion } from "./app-version";
import type { RuntimeConfigResult } from "../shared/runtime-config";

function getHomeDir(): string {
  return process.env.HOME || process.env.USERPROFILE || "/root";
}

interface TrayConfigJSON {
  server_url?: string;
  app_url?: string;
  workspace_id?: string;
  token?: string;
}

export interface TrayWindowConfig {
  apiUrl: string;
  wsUrl: string;
  appUrl: string;
  token: string;
  workspaceId: string;
  userId: string;
  appVersion: string;
  os: string;
}

const BUNDLED_ICON_PATH = pathJoin(__dirname, "../../resources/icon.png").replace(
  "app.asar",
  "app.asar.unpacked",
);

let tray: Tray | null = null;
let trayWindow: BrowserWindow | null = null;
let trayConfig: TrayWindowConfig | null = null;

function readCLIConfig(): TrayConfigJSON | null {
  try {
    const configPath = pathJoin(getHomeDir(), ".multica", "config.json");
    const raw = readFileSync(configPath, "utf-8");
    return JSON.parse(raw) as TrayConfigJSON;
  } catch {
    return null;
  }
}

function getOS(): string {
  const p = process.platform;
  return p === "darwin" ? "macos" : p === "win32" ? "windows" : p;
}

export async function startTray(): Promise<void> {
  const cliConfig = readCLIConfig();
  if (!cliConfig?.token || !cliConfig?.workspace_id) {
    console.error("[tray] Missing PAT or workspace_id in ~/.multica/config.json");
    app.quit();
    return;
  }

  const runtimeConfigResult: RuntimeConfigResult = await loadRuntimeConfig({
    isDev: is.dev,
    env: {
      apiUrl: (import.meta as Record<string, unknown>).env
        ? ((import.meta as { env: Record<string, string> }).env.VITE_API_URL)
        : undefined,
      wsUrl: (import.meta as Record<string, unknown>).env
        ? ((import.meta as { env: Record<string, string> }).env.VITE_WS_URL)
        : undefined,
      appUrl: (import.meta as Record<string, unknown>).env
        ? ((import.meta as { env: Record<string, string> }).env.VITE_APP_URL)
        : undefined,
    },
  });

  const config = runtimeConfigResult.ok
    ? runtimeConfigResult.config
    : {
        apiUrl: "https://api.multica.ai",
        wsUrl: "wss://api.multica.ai/ws",
        appUrl: "https://multica.ai",
        schemaVersion: 1 as const,
      };

  trayConfig = {
    apiUrl: config.apiUrl,
    wsUrl: config.wsUrl,
    appUrl: config.appUrl,
    token: cliConfig.token,
    workspaceId: cliConfig.workspace_id,
    userId: "",
    appVersion: getAppVersion(),
    os: getOS(),
  };

  let trayIcon = nativeImage.createEmpty();
  try {
    trayIcon = nativeImage.createFromPath(BUNDLED_ICON_PATH);
    if (process.platform === "darwin") {
      trayIcon = trayIcon.resize({ width: 18, height: 18 });
    } else {
      trayIcon = trayIcon.resize({ width: 16, height: 16 });
    }
  } catch {
    console.warn("[tray] Could not load tray icon, using empty icon");
  }

  tray = new Tray(trayIcon);
  tray.setToolTip("Multica");

  if (process.platform === "darwin") {
    tray.setTitle("");
  }

  tray.on("click", () => {
    toggleTrayWindow();
  });

  tray.on("right-click", () => {
    toggleTrayWindow();
  });

  createTrayWindow();

  setupAutoStart();
}

function createTrayWindow(): void {
  trayWindow = new BrowserWindow({
    width: 360,
    height: 480,
    frame: false,
    alwaysOnTop: false,
    skipTaskbar: true,
    show: false,
    resizable: false,
    maximizable: false,
    minimizable: false,
    hasShadow: true,
    webPreferences: {
      preload: pathJoin(__dirname, "../preload/tray.js"),
      sandbox: false,
      webSecurity: false,
      contextIsolation: true,
    },
  });

  trayWindow.webContents.setWindowOpenHandler((details) => {
    openExternalSafely(details.url);
    return { action: "deny" };
  });

  trayWindow.on("blur", () => {
    trayWindow?.hide();
  });

  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    const url = `${process.env["ELECTRON_RENDERER_URL"]}tray/index.html`;
    trayWindow.loadURL(url);
  } else {
    trayWindow.loadFile(pathJoin(__dirname, "../renderer/tray/index.html"));
  }
}

function toggleTrayWindow(): void {
  if (!trayWindow) return;

  if (trayWindow.isVisible()) {
    trayWindow.hide();
    return;
  }

  const trayBounds = tray?.getBounds();
  if (trayBounds) {
    const display = screen.getDisplayMatching(trayBounds);
    const workArea = display.workArea;
    const windowBounds = trayWindow.getBounds();
    let x = trayBounds.x + Math.round(trayBounds.width / 2) - Math.round(windowBounds.width / 2);
    let y = trayBounds.y + trayBounds.height + 4;

    if (process.platform !== "darwin") {
      y = trayBounds.y - windowBounds.height - 4;
      if (y < workArea.y) {
        y = trayBounds.y + trayBounds.height + 4;
      }
    }

    if (x + windowBounds.width > workArea.x + workArea.width) {
      x = workArea.x + workArea.width - windowBounds.width;
    }
    if (x < workArea.x) {
      x = workArea.x;
    }

    trayWindow.setPosition(x, y);
  }

  trayWindow.show();
  trayWindow.focus();
}

ipcMain.on("tray:get-config", (event) => {
  event.returnValue = trayConfig;
});

ipcMain.on("tray:set-badge", (_event, count: number) => {
  if (!tray) return;

  const safeCount = Math.max(0, Math.floor(count));

  if (process.platform === "darwin") {
    if (safeCount === 0) {
      tray.setTitle("");
    } else {
      tray.setTitle(safeCount > 99 ? "99+" : String(safeCount));
    }
  } else {
    tray.setToolTip(
      safeCount === 0 ? "Multica" : `Multica · ${safeCount > 99 ? "99+" : safeCount} unread`,
    );
  }
});

ipcMain.on("tray:show-notification", (_event, payload: {
  title: string;
  body: string;
  issueKey?: string;
  itemId?: string;
}) => {
  if (!Notification.isSupported()) return;

  const notification = new Notification({
    title: payload.title,
    body: payload.body,
    silent: false,
  });

  notification.on("click", () => {
    if (trayConfig?.appUrl && payload.issueKey) {
      const issueUrl = `${trayConfig.appUrl}/workspaces/current/issues/${payload.issueKey}`;
      openExternalSafely(issueUrl);
    }
  });

  notification.show();
});

ipcMain.on("tray:auth-failed", () => {
  if (!tray) return;
  tray.setToolTip("Multica — Authentication failed. Click to re-login.");
  if (process.platform === "darwin") {
    tray.setTitle("!");
  }
});

function setupAutoStart(): void {
  app.setLoginItemSettings({
    openAtLogin: true,
    openAsHidden: true,
    args: ["--tray-only"],
  });
}

export function destroyTray(): void {
  if (trayWindow) {
    trayWindow.destroy();
    trayWindow = null;
  }
  if (tray) {
    tray.destroy();
    tray = null;
  }
}
