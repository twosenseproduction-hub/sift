import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { getBYOKAnthropicKey } from "./byok-settings";
import {
  clearMetaSiftSessionStorage,
  notifyMetaSiftBannerDismissed,
} from "./metaSift";

const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

// Token is held in-memory AND persisted to localStorage so sessions survive
// page reloads. The fetch helpers (which run outside React) read the current
// token without prop drilling. localStorage writes are wrapped in try/catch
// because storage can be blocked (private mode, sandboxed iframes) — in those
// cases we silently fall back to in-memory only.
const STORAGE_KEY = "sift.authToken";

function readStoredToken(): string | null {
  try {
    return typeof localStorage !== "undefined"
      ? localStorage.getItem(STORAGE_KEY)
      : null;
  } catch {
    return null;
  }
}

let authToken: string | null = readStoredToken();

export function setAuthToken(token: string | null) {
  authToken = token;
  try {
    if (typeof localStorage === "undefined") return;
    if (token) localStorage.setItem(STORAGE_KEY, token);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage unavailable — in-memory token still works for this session.
  }
}

export function getAuthToken(): string | null {
  return authToken;
}

function authHeaders(): Record<string, string> {
  return authToken ? { Authorization: `Bearer ${authToken}` } : {};
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const headers: Record<string, string> = { ...authHeaders() };
  let payload = data;
  if (
    method === "POST" &&
    url === "/api/sift" &&
    payload &&
    typeof payload === "object"
  ) {
    try {
      let p = { ...(payload as Record<string, unknown>) };
      if (
        typeof sessionStorage !== "undefined" &&
        sessionStorage.getItem("sift.pendingMetaSift") === "1"
      ) {
        p = { ...p, metaSift: true };
      }
      payload = p;
    } catch {
      /* ignore */
    }
  }
  const byok = getBYOKAnthropicKey();
  if (
    byok &&
    method === "POST" &&
    (url === "/api/sift" || url === "/api/sift/fragments")
  ) {
    headers["x-sift-anthropic-key"] = byok;
  }
  if (payload) headers["Content-Type"] = "application/json";

  const isSiftPost = method === "POST" && url === "/api/sift";

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${url}`, {
      method,
      headers,
      body: payload ? JSON.stringify(payload) : undefined,
    });
  } catch (err) {
    if (isSiftPost) {
      clearMetaSiftSessionStorage();
      notifyMetaSiftBannerDismissed();
    }
    throw err;
  }

  try {
    await throwIfResNotOk(res);
  } catch (err) {
    if (isSiftPost) {
      clearMetaSiftSessionStorage();
      notifyMetaSiftBannerDismissed();
    }
    throw err;
  }

  if (isSiftPost && res.ok) {
    try {
      clearMetaSiftSessionStorage();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("sift:sift-submitted"));
      }
    } catch {
      /* ignore */
    }
  }

  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(`${API_BASE}${queryKey.join("/")}`, {
      headers: authHeaders(),
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
