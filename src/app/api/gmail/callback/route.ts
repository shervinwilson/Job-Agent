import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isOwner } from "@/lib/auth";
import { encrypt } from "@/lib/crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(req: Request) {
  const u = new URL(req.url), back = (q: string) => NextResponse.redirect(`${u.origin}/?${q}`);
  if (!(await isOwner())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const code = u.searchParams.get("code"), state = u.searchParams.get("state");
  if (!code || !state || state !== cookies().get("gmail_state")?.value) return back("gmail=error");
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: `${u.origin}/api/gmail/callback`, grant_type: "authorization_code" }) });
  const j = await r.json();
  const scope: string = j.scope ?? "";
  if (!r.ok || !j.refresh_token || !scope.includes("gmail.compose")) return back("gmail=error");
  await supabaseAdmin().from("oauth_tokens").upsert({ provider: "google", encrypted_refresh_token: encrypt(j.refresh_token), scopes: scope.split(" ") });
  const res = back("gmail=connected");
  res.cookies.delete("gmail_state");
  return res;
}
