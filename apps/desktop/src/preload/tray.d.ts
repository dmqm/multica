interface TrayAPI {
  getConfig: () => {
    apiUrl: string;
    wsUrl: string;
    appUrl: string;
    token: string;
    workspaceId: string;
    userId: string;
    appVersion: string;
    os: string;
  } | null;
  showNotification: (payload: {
    title: string;
    body: string;
    issueKey?: string;
    itemId?: string;
  }) => void;
  setBadge: (count: number) => void;
  authFailed: () => void;
}

declare global {
  interface Window {
    trayAPI: TrayAPI;
  }
}

export {};
