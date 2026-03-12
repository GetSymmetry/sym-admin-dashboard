/**
 * DebuggerClient — single HTTP client for all debugger service calls.
 * In prod, base URL points to Front Door (-> sym-router -> regional debugger).
 * In dev, points directly to local debugger service.
 */
import type { DebugResponse } from "./types";

const BASE_URL = (
  process.env.NEXT_PUBLIC_DEBUGGER_URL || "http://localhost:8004/api"
).trim();

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
      credentials: "include", // Send httpOnly cookie
    });

    if (res.status === 401) {
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
      throw new Error("Unauthorized");
    }

    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(error.detail || `HTTP ${res.status}`);
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
}

export const debuggerClient = new DebuggerClient();
export { DebuggerClient };
