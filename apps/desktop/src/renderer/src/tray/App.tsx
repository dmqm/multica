import { useEffect, useState, useCallback, useRef } from "react";
import { ApiClient, setApiInstance } from "@multica/core/api";
import { WSClient } from "@multica/core/api/ws-client";
import { createLogger } from "@multica/core/logger";
import { TrayDashboard, useTrayDashboardData } from "@multica/views/tray";

interface TrayConfig {
  apiUrl: string;
  wsUrl: string;
  appUrl: string;
  token: string;
  workspaceId: string;
  userId: string;
  appVersion: string;
  os: string;
}

export function TrayApp() {
  const [config, setConfig] = useState<TrayConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WSClient | null>(null);

  useEffect(() => {
    const trayAPI = (window as unknown as Record<string, unknown>).trayAPI as
      | { getConfig: () => TrayConfig | null }
      | undefined;

    if (!trayAPI?.getConfig) {
      setError("Tray API not available");
      return;
    }

    const cfg = trayAPI.getConfig();
    if (!cfg) {
      setError("Tray config not available");
      return;
    }

    setConfig(cfg);
  }, []);

  useEffect(() => {
    if (!config) return;

    const api = new ApiClient(config.apiUrl, {
      logger: createLogger("tray-api"),
      identity: {
        platform: "desktop_tray",
        version: config.appVersion,
        os: config.os,
      },
    });
    api.setToken(config.token);
    setApiInstance(api);

    const ws = new WSClient(config.wsUrl, {
      logger: createLogger("tray-ws"),
      identity: {
        platform: "desktop_tray",
        version: config.appVersion,
        os: config.os,
      },
    });
    ws.setAuth(config.token, "__tray__"); // workspace_slug for auth routing
    ws.connect();
    wsRef.current = ws;

    return () => {
      ws.disconnect();
      wsRef.current = null;
    };
  }, [config]);

  const handleNotification = useCallback(
    (payload: { title: string; body: string; issueKey?: string; itemId?: string }) => {
      const trayAPI = (window as unknown as Record<string, unknown>).trayAPI as
        | {
            showNotification?: (p: {
              title: string;
              body: string;
              issueKey?: string;
              itemId?: string;
            }) => void;
            setBadge?: (count: number) => void;
          }
        | undefined;

      trayAPI?.showNotification?.(payload);
    },
    [],
  );

  const handleBadgeUpdate = useCallback(
    (count: number) => {
      const trayAPI = (window as unknown as Record<string, unknown>).trayAPI as
        | { setBadge?: (count: number) => void }
        | undefined;

      trayAPI?.setBadge?.(count);
    },
    [],
  );

  const wsId = config?.workspaceId ?? null;
  const userId = config?.userId ?? null;

  const data = useTrayDashboardData({
    wsId,
    userId,
    ws: wsRef.current,
    onNotification: handleNotification,
  });

  useEffect(() => {
    handleBadgeUpdate(data.unreadCount);
  }, [data.unreadCount, handleBadgeUpdate]);

  if (error) {
    return (
      <div
        style={{
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "sans-serif",
          fontSize: "13px",
          color: "#ef4444",
          padding: "16px",
        }}
      >
        {error}
      </div>
    );
  }

  if (!config) {
    return (
      <div
        style={{
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "sans-serif",
          fontSize: "13px",
          color: "#6b7280",
        }}
      >
        Loading...
      </div>
    );
  }

  return (
    <TrayDashboard
      unreadCount={data.unreadCount}
      unreadItems={data.unreadItems}
      issues={data.issues}
      tasks={data.tasks}
    />
  );
}
