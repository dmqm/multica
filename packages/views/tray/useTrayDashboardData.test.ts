import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { useTrayDashboardData } from "./useTrayDashboardData";
import { setApiInstance, type ApiClientType } from "@multica/core/api";
import type { InboxItem, Issue, IssueStatus } from "@multica/core/types";

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

function createMockInbox(overrides: Partial<InboxItem> = {}): InboxItem {
  return {
    id: "i1",
    workspace_id: "ws-1",
    recipient_type: "member",
    recipient_id: "u-1",
    actor_type: null,
    actor_id: null,
    type: "mentioned",
    severity: "attention",
    issue_id: null,
    title: "Notification",
    body: null,
    issue_status: null,
    read: false,
    archived: false,
    created_at: new Date().toISOString(),
    details: null,
    ...overrides,
  };
}

function createMockIssue(overrides: Partial<Issue> = {}): Issue {
  return {
    id: "iss-1",
    workspace_id: "ws-1",
    number: 1,
    identifier: "MUL-1",
    title: "Test issue",
    description: null,
    status: "in_progress" as IssueStatus,
    priority: "medium",
    assignee_type: "member",
    assignee_id: "u-1",
    creator_type: "member",
    creator_id: "u-2",
    parent_issue_id: null,
    project_id: null,
    position: 0,
    due_date: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function mockWSClient() {
  const handlers = new Map<string, Set<(...args: unknown[]) => void>>();
  const reconnectCallbacks = new Set<() => void>();

  return {
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      if (!handlers.has(event)) handlers.set(event, new Set());
      handlers.get(event)!.add(handler);
      return () => handlers.get(event)?.delete(handler);
    }),
    onReconnect: vi.fn((cb: () => void) => {
      reconnectCallbacks.add(cb);
      return () => reconnectCallbacks.delete(cb);
    }),
    connect: vi.fn(),
    disconnect: vi.fn(),
    setAuth: vi.fn(),
    emit: (event: string, payload: unknown, actorId?: string, actorType?: string) => {
      handlers.get(event)?.forEach((h) => h(payload, actorId, actorType));
    },
    triggerReconnect: () => {
      reconnectCallbacks.forEach((cb) => cb());
    },
  };
}

type Mocks = ReturnType<typeof createMocks>;

function createMocks() {
  return {
    listInbox: vi.fn().mockResolvedValue([]),
    listIssues: vi.fn().mockResolvedValue({ issues: [], total: 0 }),
    getAgentTaskSnapshot: vi.fn().mockResolvedValue([]),
  };
}

function installApiMocks(mocks: Mocks) {
  const api = {
    listInbox: mocks.listInbox,
    listIssues: mocks.listIssues,
    getAgentTaskSnapshot: mocks.getAgentTaskSnapshot,
  } as unknown as ApiClientType;
  setApiInstance(api);
}

describe("useTrayDashboardData", () => {
  let queryClient: QueryClient;
  let mockWs: ReturnType<typeof mockWSClient>;
  let mocks: Mocks;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
      },
    });
    mockWs = mockWSClient();
    mocks = createMocks();
    installApiMocks(mocks);
  });

  afterEach(() => {
    queryClient.clear();
  });

  it("returns initial state with zero unread count", async () => {
    const { result } = renderHook(
      () => useTrayDashboardData({ wsId: "ws-1", userId: "u-1", ws: mockWs as never }),
      { wrapper: createWrapper(queryClient) },
    );

    await waitFor(() => {
      expect(result.current.unreadCount).toBe(0);
      expect(result.current.issues).toEqual([]);
      expect(result.current.tasks).toEqual([]);
    });
  });

  it("fetches inbox unread count on mount", async () => {
    mocks.listInbox.mockResolvedValue([
      createMockInbox({ id: "i1", issue_id: "issue-1" }),
      createMockInbox({ id: "i2", issue_id: "issue-2" }),
    ]);

    const { result } = renderHook(
      () => useTrayDashboardData({ wsId: "ws-1", userId: "u-1", ws: mockWs as never }),
      { wrapper: createWrapper(queryClient) },
    );

    await waitFor(() => {
      expect(result.current.unreadCount).toBe(2);
    });
    expect(mocks.listInbox).toHaveBeenCalledOnce();
  });

  it("invalidates inbox queries on inbox:new WS event", async () => {
    const { result } = renderHook(
      () => useTrayDashboardData({ wsId: "ws-1", userId: "u-1", ws: mockWs as never }),
      { wrapper: createWrapper(queryClient) },
    );

    await waitFor(() => {
      expect(result.current.unreadCount).toBe(0);
    });
    const initialCalls = mocks.listInbox.mock.calls.length;

    mockWs.emit("inbox:new", {
      item: createMockInbox({ id: "i3", issue_id: "issue-3" }),
    });

    await waitFor(() => {
      expect(mocks.listInbox.mock.calls.length).toBeGreaterThan(initialCalls);
    });
  });

  it("fetches my assigned issues", async () => {
    mocks.listIssues.mockImplementation((params: { status?: string }) => {
      return Promise.resolve({
        issues: params.status === "in_progress"
          ? [createMockIssue({ id: "iss-1", identifier: "MUL-1", title: "Test issue", status: "in_progress" })]
          : [],
        total: params.status === "in_progress" ? 1 : 0,
      });
    });

    const { result } = renderHook(
      () => useTrayDashboardData({ wsId: "ws-1", userId: "u-1", ws: mockWs as never }),
      { wrapper: createWrapper(queryClient) },
    );

    await waitFor(() => {
      expect(result.current.issues).toHaveLength(1);
      expect(result.current.issues[0].status).toBe("in_progress");
    });
  });

  it("invalidates issues on issue:updated WS event", async () => {
    const { result } = renderHook(
      () => useTrayDashboardData({ wsId: "ws-1", userId: "u-1", ws: mockWs as never }),
      { wrapper: createWrapper(queryClient) },
    );

    await waitFor(() => {
      expect(result.current.issues).toHaveLength(0);
    });
    const initialCalls = mocks.listIssues.mock.calls.length;

    mockWs.emit("issue:updated", {
      issue: createMockIssue({ id: "iss-2", identifier: "MUL-2", title: "Updated", status: "in_progress" }),
    });

    await waitFor(() => {
      expect(mocks.listIssues.mock.calls.length).toBeGreaterThan(initialCalls);
    });
  });

  it("filters issues to only in_progress and blocked", async () => {
    mocks.listIssues.mockImplementation((params: { status?: string }) => {
      const status = (params.status ?? "todo") as IssueStatus;
      const issue = createMockIssue({ id: status, identifier: status, title: status, status });
      return Promise.resolve({ issues: [issue], total: 1 });
    });

    const { result } = renderHook(
      () => useTrayDashboardData({ wsId: "ws-1", userId: "u-1", ws: mockWs as never }),
      { wrapper: createWrapper(queryClient) },
    );

    await waitFor(() => {
      expect(result.current.issues).toHaveLength(2);
    });
    expect(result.current.issues.map((i) => i.status).sort()).toEqual(["blocked", "in_progress"]);
  });

  it("calls onNotification for inbox:new events", async () => {
    const onNotification = vi.fn();

    const { result } = renderHook(
      () =>
        useTrayDashboardData({
          wsId: "ws-1",
          userId: "u-1",
          ws: mockWs as never,
          onNotification,
        }),
      { wrapper: createWrapper(queryClient) },
    );

    await waitFor(() => {
      expect(result.current.unreadCount).toBe(0);
    });

    mockWs.emit("inbox:new", {
      item: createMockInbox({
        id: "i-n",
        issue_id: "iss-n",
        title: "You were mentioned",
        body: "Someone @mentioned you",
      }),
    });

    expect(onNotification).toHaveBeenCalledWith({
      title: "You were mentioned",
      body: "Someone @mentioned you",
      issueKey: "iss-n",
      itemId: "i-n",
    });
  });

  it("calls onNotification for issue:updated assigned to current user", async () => {
    const onNotification = vi.fn();

    const { result } = renderHook(
      () =>
        useTrayDashboardData({
          wsId: "ws-1",
          userId: "u-1",
          ws: mockWs as never,
          onNotification,
        }),
      { wrapper: createWrapper(queryClient) },
    );

    await waitFor(() => {
      expect(result.current.unreadCount).toBe(0);
    });

    mockWs.emit("issue:updated", {
      issue: createMockIssue({
        id: "iss-as",
        identifier: "MUL-20",
        title: "Assigned to you",
        assignee_id: "u-1",
      }),
    });

    expect(onNotification).toHaveBeenCalledWith({
      title: "New issue assigned",
      body: "Assigned to you",
      issueKey: "MUL-20",
    });
  });

  it("does not call onNotification for issue:updated not assigned to user", async () => {
    const onNotification = vi.fn();

    const { result } = renderHook(
      () =>
        useTrayDashboardData({
          wsId: "ws-1",
          userId: "u-1",
          ws: mockWs as never,
          onNotification,
        }),
      { wrapper: createWrapper(queryClient) },
    );

    await waitFor(() => {
      expect(result.current.unreadCount).toBe(0);
    });

    mockWs.emit("issue:updated", {
      issue: createMockIssue({
        id: "iss-other",
        identifier: "MUL-30",
        title: "Not for you",
        assignee_id: "u-2",
      }),
    });

    expect(onNotification).not.toHaveBeenCalled();
  });

  it("calls onNotification for issue:created where user is assignee", async () => {
    const onNotification = vi.fn();

    const { result } = renderHook(
      () =>
        useTrayDashboardData({
          wsId: "ws-1",
          userId: "u-1",
          ws: mockWs as never,
          onNotification,
        }),
      { wrapper: createWrapper(queryClient) },
    );

    await waitFor(() => {
      expect(result.current.unreadCount).toBe(0);
    });

    mockWs.emit("issue:created", {
      issue: createMockIssue({
        id: "iss-new",
        identifier: "MUL-40",
        title: "New bug assigned",
        assignee_id: "u-1",
      }),
    });

    expect(onNotification).toHaveBeenCalledWith({
      title: "New issue assigned",
      body: "New bug assigned",
      issueKey: "MUL-40",
    });
  });

  it("fetches agent task snapshot on mount", async () => {
    mocks.getAgentTaskSnapshot.mockResolvedValue([
      { id: "t1", issue_id: "iss-1", status: "running", agent_id: "agent-1", created_at: new Date().toISOString() },
    ]);

    const { result } = renderHook(
      () => useTrayDashboardData({ wsId: "ws-1", userId: "u-1", ws: mockWs as never }),
      { wrapper: createWrapper(queryClient) },
    );

    await waitFor(() => {
      expect(result.current.tasks).toHaveLength(1);
      expect(result.current.tasks[0].status).toBe("running");
    });
  });

  it("invalidates tasks on task:completed WS event", async () => {
    const { result } = renderHook(
      () => useTrayDashboardData({ wsId: "ws-1", userId: "u-1", ws: mockWs as never }),
      { wrapper: createWrapper(queryClient) },
    );

    await waitFor(() => {
      expect(result.current.tasks).toHaveLength(0);
    });
    const initialCalls = mocks.getAgentTaskSnapshot.mock.calls.length;

    mockWs.emit("task:completed", { task_id: "t-done" });

    await waitFor(() => {
      expect(mocks.getAgentTaskSnapshot.mock.calls.length).toBeGreaterThan(initialCalls);
    });
  });

  it("returns unread inbox items with deduplication", async () => {
    mocks.listInbox.mockResolvedValue([
      createMockInbox({ id: "i-a", issue_id: "iss-a", read: false, created_at: "2026-01-02T00:00:00Z" }),
      createMockInbox({ id: "i-b", issue_id: "iss-a", read: true, created_at: "2026-01-01T00:00:00Z" }),
    ]);

    const { result } = renderHook(
      () => useTrayDashboardData({ wsId: "ws-1", userId: "u-1", ws: mockWs as never }),
      { wrapper: createWrapper(queryClient) },
    );

    await waitFor(() => {
      expect(mocks.listInbox).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(result.current.unreadCount).toBe(1);
    });
    expect(result.current.unreadItems).toHaveLength(1);
    expect(result.current.unreadItems[0].issue_id).toBe("iss-a");
  });

  it("triggers reconnect refresh on WS reconnect", async () => {
    const { result } = renderHook(
      () => useTrayDashboardData({ wsId: "ws-1", userId: "u-1", ws: mockWs as never }),
      { wrapper: createWrapper(queryClient) },
    );

    await waitFor(() => {
      expect(result.current.unreadCount).toBe(0);
    });
    const initialCalls = mocks.listInbox.mock.calls.length;

    mockWs.triggerReconnect();

    await waitFor(() => {
      expect(mocks.listInbox.mock.calls.length).toBeGreaterThan(initialCalls);
    });
  });
});
