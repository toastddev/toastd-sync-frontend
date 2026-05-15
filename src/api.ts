// Normalize the API URL so a missing protocol or stray trailing slash doesn't
// turn `${API_URL}${path}` into a relative URL that gets glued onto the
// current page (which produced bugs like /sync/sync.toastd.in/api/...).
function normalizeApiUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (!trimmed) return "http://localhost:8787";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}
const API_URL = normalizeApiUrl(
  import.meta.env.VITE_SYNC_APP_API || "http://localhost:8787",
);
const TOKEN_KEY = "tvs_token";

// When the SPA is mounted under a sub-path (e.g. /sync inside admin),
// `import.meta.env.BASE_URL` is "/sync/". Use it as the prefix for full-page
// redirects so we don't accidentally escape the embed.
const BASE_PATH = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "") || "";

export const auth = {
  get token(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },
  set token(t: string | null) {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  },
  get isAuthed() {
    return !!auth.token;
  },
  logout() {
    auth.token = null;
    location.href = `${BASE_PATH}/login`;
  },
};

export class ApiError extends Error {
  constructor(public status: number, public payload: any) {
    super(typeof payload === "string" ? payload : payload?.error || `HTTP ${status}`);
  }
}

// silent401: clear the token but do NOT do a hard redirect. Used by background
// pollers (authStatus, syncStatus, logs) so an expired session doesn't bounce
// the user out of the embed mid-idle — they redirect cleanly on the next
// user-initiated action instead.
async function request<T = any>(
  path: string,
  init: RequestInit = {},
  opts: { silent401?: boolean } = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (auth.token) headers.set("Authorization", `Bearer ${auth.token}`);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  const text = await res.text();
  let payload: any = null;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = text; }
  if (res.status === 401 && path !== "/api/auth/login") {
    auth.token = null;
    if (!opts.silent401) location.href = `${BASE_PATH}/login`;
  }
  if (!res.ok) throw new ApiError(res.status, payload);
  return payload as T;
}

export const api = {
  login: (password: string) => request<{ token: string }>("/api/auth/login", { method: "POST", body: JSON.stringify({ password }) }),

  getSettings: () => request<any>("/api/settings"),
  putSettings: (s: any) => request<any>("/api/settings", { method: "PUT", body: JSON.stringify(s) }),
  authStatus: () => request<any>("/api/settings/auth-status", {}, { silent401: true }),
  refreshShipturtleToken: () =>
    request<{ ok: boolean; expiresIn?: number; tokenTail?: string; error?: string }>(
      "/api/settings/shipturtle/refresh",
      { method: "POST" },
    ),

  getBrands: () => request<any[]>("/api/brands"),

  listVendors: () => request<any[]>("/api/vendors"),
  refreshVendors: () => request<{ count: number }>("/api/vendors/refresh", { method: "POST" }),
  searchVendors: (body: { search?: string; start?: number; length?: number }) =>
    request<{ data: any[]; recordsTotal: number; recordsFiltered: number }>(
      "/api/vendors/search",
      { method: "POST", body: JSON.stringify(body) },
    ),
  getVendor: (id: string) => request<any>(`/api/vendors/${id}`),
  patchVendor: (id: string, body: any) => request<any>(`/api/vendors/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  vendorProducts: (id: string) => request<any[]>(`/api/vendors/${id}/products`),
  refreshVendorProducts: (id: string) => request<{ count: number }>(`/api/vendors/${id}/products/refresh`, { method: "POST" }),
  searchVendorProducts: (id: string, body: { search?: string; start?: number; length?: number; filters?: any }) =>
    request<{ data: any[]; recordsTotal: number; recordsFiltered: number }>(
      `/api/vendors/${id}/products/search`,
      { method: "POST", body: JSON.stringify(body) },
    ),

  syncVendor: (id: string) => request<{ jobId: string }>(`/api/sync/vendor/${id}`, { method: "POST" }),
  syncProduct: (vendorId: string, alienProductId: number | string) =>
    request<{
      queued: boolean;
      running?: boolean;
      duplicate?: boolean;
      position: number;
      queueDepth: number;
    }>(`/api/sync/product/${vendorId}/${alienProductId}`, { method: "POST" }),
  runAll: () => request<any>(`/api/sync/run-all`, { method: "POST" }),
  syncStatus: () =>
    request<{
      current: any | null;
      queue: Array<{
        vendorId: string;
        vendorShopId: number;
        alienProductId: number;
        vendorName?: string | null;
        brandName?: string | null;
        productTitle?: string | null;
        enqueuedAt: number;
      }>;
      queueDepth: number;
    }>("/api/sync/status", {}, { silent401: true }),
  syncJobs: () => request<any[]>("/api/sync/jobs"),

  regressions: () => request<any[]>("/api/products/regressions"),
  runDriftCheck: (vendorId?: string) =>
    request<any>("/api/products/drift-check", { method: "POST", body: JSON.stringify(vendorId ? { vendorId } : {}) }),

  logs: (params?: { limit?: number; vendorId?: string; level?: string }) => {
    const u = new URL(`${API_URL}/api/logs`);
    if (params?.limit) u.searchParams.set("limit", String(params.limit));
    if (params?.vendorId) u.searchParams.set("vendorId", params.vendorId);
    if (params?.level) u.searchParams.set("level", params.level);
    return request<any[]>(`/api/logs?${u.searchParams.toString()}`, {}, { silent401: true });
  },
  logStreamUrl: () => `${API_URL}/api/logs/stream`,
  apiUrl: API_URL,
};
