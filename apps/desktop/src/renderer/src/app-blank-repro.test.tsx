import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { createAuthStore, registerAuthStore, useAuthStore } from "@multica/core/auth";
import { AuthInitializer } from "@multica/core/platform";
import { setApiInstance } from "@multica/core/api";
import { QueryClientProvider } from "@tanstack/react-query";
import { createQueryClient } from "@multica/core/query-client";
import type { ApiClient } from "@multica/core/api/client";

function createFakeApi(overrides: Partial<ApiClient> = {}): ApiClient {
  return {
    baseUrl: "https://api.example.com",
    setToken: vi.fn(),
    getMe: vi.fn(),
    listWorkspaces: vi.fn(),
    getConfig: vi.fn().mockRejectedValue(new Error("no config")),
    ...overrides,
  } as unknown as ApiClient;
}

describe("first-launch: no token in storage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("flips isLoading to false when there is no token in localStorage", async () => {
    expect(localStorage.getItem("multica_token")).toBeNull();

    const api = createFakeApi();
    setApiInstance(api);

    const store = createAuthStore({ api, storage: localStorage });
    registerAuthStore(store);

    expect(useAuthStore.getState().isLoading).toBe(true);

    const queryClient = createQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <AuthInitializer storage={localStorage}>
          <div>children</div>
        </AuthInitializer>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(useAuthStore.getState().isLoading).toBe(false);
    });
    expect(useAuthStore.getState().user).toBeNull();
  });

  it("renders children even when no token is present", () => {
    const api = createFakeApi();
    setApiInstance(api);

    const store = createAuthStore({
      api,
      storage: {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
      },
    });
    registerAuthStore(store);

    const queryClient = createQueryClient();
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <AuthInitializer
          storage={{
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
          }}
        >
          <div data-testid="content">app content</div>
        </AuthInitializer>
      </QueryClientProvider>,
    );

    expect(container.textContent).toContain("app content");
  });
});
