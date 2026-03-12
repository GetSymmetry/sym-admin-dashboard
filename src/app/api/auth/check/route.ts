import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("sym_debug_token");
  return NextResponse.json({ authenticated: !!token });
}
