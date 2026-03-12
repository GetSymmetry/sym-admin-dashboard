/**
 * Catch-all proxy for debugger service API calls.
 *
 * The dashboard stores the Entra CIAM JWT in an httpOnly cookie
 * (sym_debug_token). Client-side code can't read this cookie or send
 * it cross-origin to the debugger service. This proxy reads the cookie
 * server-side and forwards requests with a Bearer token.
 *
 * Client calls:  /api/debug/insights/pulse?timeRange=24h
 * Proxy calls:   ${DEBUGGER_URL}/debug/insights/pulse?timeRange=24h
 */
import { NextRequest, NextResponse } from "next/server";

const DEBUGGER_URL = (
  process.env.NEXT_PUBLIC_DEBUGGER_URL || "http://localhost:8004/api"
).trim();

async function proxy(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const pathStr = path.join("/");
  const search = request.nextUrl.search;
  const targetUrl = `${DEBUGGER_URL}/debug/${pathStr}${search}`;

  const token = request.cookies.get("sym_debug_token")?.value;
  const headers: Record<string, string> = {
    "Content-Type": request.headers.get("content-type") || "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const region = request.headers.get("x-debug-region");
  if (region) {
    headers["X-Debug-Region"] = region;
  }

  const body = request.method !== "GET" && request.method !== "HEAD"
    ? await request.text()
    : undefined;

  try {
    const res = await fetch(targetUrl, {
      method: request.method,
      headers,
      body,
    });

    const data = await res.text();
    return new NextResponse(data, {
      status: res.status,
      headers: { "Content-Type": res.headers.get("content-type") || "application/json" },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Debugger service unavailable", detail: err.message },
      { status: 502 }
    );
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const DELETE = proxy;
export const PATCH = proxy;
