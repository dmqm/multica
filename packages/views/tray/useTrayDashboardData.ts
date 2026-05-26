"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useCallback } from "react";
import { api } from "@multica/core/api";
import { inboxKeys, deduplicateInboxItems } from "@multica/core/inbox";
import { issueKeys } from "@multica/core/issues/queries";
import type { WSClient } from "@multica/core/api/ws-client";
import type {
  InboxItem,
  IssueStatus,
  InboxNewPayload,
  IssueUpdatedPayload,
  IssueCreatedPayload,
} from "@multica/core/types";

export interface TrayDashboardData {
  unreadCount: number;
  unreadItems: InboxItem[];
  issues: TrayIssue[];
  tasks: TrayTask[];
}

export interface TrayIssue {
  id: string;
  identifier: string;
  title: string;
  status: IssueStatus;
}

export interface TrayTask {
  id: string;
  issue_id: string;
  status: string;
  agent_id: string;
}

export interface TrayNotificationPayload {
  title: string;
  body: string;
  issueKey?: string;
  itemId?: string;
}

export interface UseTrayDashboardDataOptions {
  wsId: string | null;
  userId: string | null;
  ws: WSClient | null;
  onNotification?: (payload: TrayNotificationPayload) => void;
}

const ACTIVE_STATUSES: readonly IssueStatus[] = ["in_progress", "blocked"] as const;

async function fetchMyIssues(assigneeId: string) {
  const allStatuses: IssueStatus[] = [
    "todo",
    "in_progress",
    "in_review",
    "blocked",
    "done",
    "cancelled",
  ];

  const responses = await Promise.all(
    allStatuses.map((status) =>
      api.listIssues({ status, limit: 50, offset: 0, assignee_id: assigneeId }),
    ),
  );

  const issues: TrayIssue[] = [];
  for (const res of responses) {
    for (const issue of res.issues) {
      if (
        ACTIVE_STATUSES.includes(issue.status as IssueStatus)
      ) {
        issues.push({
          id: issue.id,
          identifier: issue.identifier,
          title: issue.title,
          status: issue.status as IssueStatus,
        });
      }
    }
  }
  return issues;
}

async function fetchInbox(): Promise<InboxItem[]> {
  return api.listInbox();
}

async function fetchTasks(): Promise<TrayTask[]> {
  const tasks = await api.getAgentTaskSnapshot();
  return tasks.map((t) => ({
    id: t.id,
    issue_id: t.issue_id,
    status: t.status,
    agent_id: t.agent_id,
  }));
}

export function useTrayDashboardData({
  wsId,
  userId,
  ws,
  onNotification,
}: UseTrayDashboardDataOptions): TrayDashboardData {
  const queryClient = useQueryClient();
  const onNotificationRef = useRef(onNotification);
  onNotificationRef.current = onNotification;
  const userIdRef = useRef(userId);
  userIdRef.current = userId;

  const inboxQuery = useQuery({
    queryKey: inboxKeys.list(wsId ?? ""),
    queryFn: fetchInbox,
    enabled: !!wsId,
    staleTime: Infinity,
  });

  const issuesQuery = useQuery({
    queryKey: [...issueKeys.all(wsId ?? ""), "tray", "my-active"],
    queryFn: () => fetchMyIssues(userId ?? ""),
    enabled: !!wsId && !!userId,
    staleTime: Infinity,
  });

  const tasksQuery = useQuery({
    queryKey: ["agent-task-snapshot", wsId],
    queryFn: fetchTasks,
    enabled: !!wsId,
    staleTime: Infinity,
  });

  const invalidateAll = useCallback(() => {
    if (!wsId) return;
    queryClient.invalidateQueries({ queryKey: inboxKeys.list(wsId) });
    queryClient.invalidateQueries({
      queryKey: [...issueKeys.all(wsId), "tray", "my-active"],
    });
    queryClient.invalidateQueries({ queryKey: ["agent-task-snapshot", wsId] });
  }, [queryClient, wsId]);

  useEffect(() => {
    if (!ws) return;

    const unsubInboxNew = ws.on("inbox:new", (raw: unknown) => {
      invalidateAll();

      const payload = raw as InboxNewPayload;
      if (onNotificationRef.current && payload?.item) {
        onNotificationRef.current({
          title: payload.item.title,
          body: payload.item.body ?? "",
          issueKey: payload.item.issue_id ?? undefined,
          itemId: payload.item.id,
        });
      }
    });

    const unsubIssueUpdated = ws.on("issue:updated", (raw: unknown) => {
      invalidateAll();

      const payload = raw as IssueUpdatedPayload;
      if (onNotificationRef.current && payload?.issue) {
        const currentUserId = userIdRef.current;
        if (
          payload.issue.assignee_id &&
          currentUserId &&
          payload.issue.assignee_id === currentUserId
        ) {
          onNotificationRef.current({
            title: "New issue assigned",
            body: payload.issue.title,
            issueKey: payload.issue.identifier,
          });
        }
      }
    });

    const unsubIssueCreated = ws.on("issue:created", (raw: unknown) => {
      invalidateAll();

      const payload = raw as IssueCreatedPayload;
      if (onNotificationRef.current && payload?.issue) {
        const currentUserId = userIdRef.current;
        if (
          payload.issue.assignee_id &&
          currentUserId &&
          payload.issue.assignee_id === currentUserId
        ) {
          onNotificationRef.current({
            title: "New issue assigned",
            body: payload.issue.title,
            issueKey: payload.issue.identifier,
          });
        }
      }
    });

    const unsubTaskCompleted = ws.on("task:completed", () => {
      if (!wsId) return;
      queryClient.invalidateQueries({ queryKey: ["agent-task-snapshot", wsId] });
    });

    const unsubTaskFailed = ws.on("task:failed", () => {
      if (!wsId) return;
      queryClient.invalidateQueries({ queryKey: ["agent-task-snapshot", wsId] });
    });

    const unsubTaskDispatched = ws.on("task:dispatch", () => {
      if (!wsId) return;
      queryClient.invalidateQueries({ queryKey: ["agent-task-snapshot", wsId] });
    });

    const unsubTaskCancelled = ws.on("task:cancelled", () => {
      if (!wsId) return;
      queryClient.invalidateQueries({ queryKey: ["agent-task-snapshot", wsId] });
    });

    const unsubTaskQueued = ws.on("task:queued", () => {
      if (!wsId) return;
      queryClient.invalidateQueries({ queryKey: ["agent-task-snapshot", wsId] });
    });

    const unsubReconnect = ws.onReconnect(() => {
      invalidateAll();
    });

    return () => {
      unsubInboxNew();
      unsubIssueUpdated();
      unsubIssueCreated();
      unsubTaskCompleted();
      unsubTaskFailed();
      unsubTaskDispatched();
      unsubTaskCancelled();
      unsubTaskQueued();
      unsubReconnect();
    };
  }, [ws, invalidateAll, queryClient, wsId]);

  const unreadCount = inboxQuery.data
    ? deduplicateInboxItems(inboxQuery.data).filter((i) => !i.read).length
    : 0;

  const unreadItems = inboxQuery.data
    ? deduplicateInboxItems(inboxQuery.data)
        .filter((i) => !i.read)
        .slice(0, 10)
    : [];

  return {
    unreadCount,
    unreadItems,
    issues: issuesQuery.data ?? [],
    tasks: tasksQuery.data ?? [],
  };
}
