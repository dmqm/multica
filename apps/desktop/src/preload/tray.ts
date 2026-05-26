import { contextBridge, ipcRenderer } from "electron";

interface TrayWindowConfig {
  apiUrl: string;
  wsUrl: string;
  appUrl: string;
  token: string;
  workspaceId: string;
  userId: string;
  appVersion: string;
  os: string;
}

const config: TrayWindowConfig | null = (() => {
  try {
    return ipcRenderer.sendSync("tray:get-config") as TrayWindowConfig | null;
  } catch {
    return null;
  }
})();

const trayAPI = {
  getConfig: (): TrayWindowConfig | null => config,
  showNotification: (payload: {
    title: string;
    body: string;
    issueKey?: string;
    itemId?: string;
  }): void => {
    ipcRenderer.send("tray:show-notification", payload);
  },
  setBadge: (count: number): void => {
    ipcRenderer.send("tray:set-badge", count);
  },
  authFailed: (): void => {
    ipcRenderer.send("tray:auth-failed");
  },
};

contextBridge.exposeInMainWorld("trayAPI", trayAPI);
