import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const { email, password } = await request.json();

  const tenantName = process.env.AZURE_ENTRA_EXTERNAL_TENANT_NAME;
  const tenantId = process.env.AZURE_ENTRA_EXTERNAL_TENANT_ID;
  const clientId = process.env.AZURE_AD_CLIENT_ID;

  if (!tenantName || !tenantId || !clientId) {
    return NextResponse.json(
      { error: "Auth not configured" },
      { status: 500 }
    );
  }

  const tokenUrl = `https://${tenantName}.ciamlogin.com/${tenantId}/oauth2/v2.0/token`;

  const body = new URLSearchParams({
    grant_type: "password",
    username: email,
    password: password,
    client_id: clientId,
    scope: "openid profile email",
  });

  const tokenRes = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.json();
    return NextResponse.json(
      { error: err.error_description || "Authentication failed" },
      { status: 401 }
    );
  }

  const data = await tokenRes.json();
  const token = data.id_token || data.access_token;
  const expiresIn = data.expires_in || 3600;

  const response = NextResponse.json({ success: true });
  response.cookies.set("sym_debug_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: expiresIn,
    path: "/",
  });

  return response;
}
