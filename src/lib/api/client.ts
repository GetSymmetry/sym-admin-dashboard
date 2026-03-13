/**
 * DebuggerClient — single HTTP client for all debugger service calls.
 * In prod, base URL points to Front Door (-> sym-router -> regional debugger).
 * In dev, points directly to local debugger service.
 */
import type { DebugResponse } from "./types";

// Client-side: proxy through /api/debug to attach auth token server-side.
// Server-side (API routes): call debugger directly via NEXT_PUBLIC_DEBUGGER_URL.
const BASE_URL = typeof window !== "undefined"
  ? "/api"  // Client → Next.js proxy → debugger (cookie → Bearer token)
  : (process.env.NEXT_PUBLIC_DEBUGGER_URL || "http://localhost:8004/api").trim();

class DebuggerClient {
  private baseUrl: string;
  private region: string = "centralus";

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || BASE_URL;
  }

  setRegion(region: string) {
    this.region = region;
  }

  getRegion(): string {
    return this.region;
  }

  async fetch<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<DebugResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Debug-Region": this.region,
      ...(options.headers as Record<string, string>),
    };

    const res = await fetch(url, {
      ...options,
      headers,
      credentials: "same-origin", // Send httpOnly cookie to same-origin proxy
    });

    if (res.status === 401) {
      // Don't redirect to login — 401 from debugger service means the
      // request lacks a valid Bearer token, not that the dashboard session
      // expired. Dashboard auth is handled by middleware + httpOnly cookie.
      throw new Error("Debugger API authentication required");
    }

    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: res.statusText }));
      let message = `HTTP ${res.status}`;
      if (typeof error.detail === "string") {
        message = error.detail;
      } else if (Array.isArray(error.detail)) {
        message = error.detail.map((e: any) => e.msg || JSON.stringify(e)).join("; ");
      }
      throw new Error(message);
    }

    return res.json();
  }

  // Convenience methods
  async get<T>(
    endpoint: string,
    params?: Record<string, string>
  ): Promise<DebugResponse<T>> {
    const query = params ? "?" + new URLSearchParams(params).toString() : "";
    return this.fetch<T>(`${endpoint}${query}`);
  }

  async post<T>(endpoint: string, body?: any): Promise<DebugResponse<T>> {
    return this.fetch<T>(endpoint, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<DebugResponse<T>> {
    return this.fetch<T>(endpoint, { method: "DELETE" });
  }
}

export const debuggerClient = new DebuggerClient();
export { DebuggerClient };
