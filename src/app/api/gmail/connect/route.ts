import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { isOwner } from "@/lib/auth";

export async function GET(req: Request) {
  if (!(await isOwner())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const origin = new URL(req.url).origin, state = randomBytes(16).toString("hex");
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID!, redirect_uri: `${origin}/api/gmail/callback`, response_type: "code",
    scope: "https://www.googleapis.com/auth/gmail.compose https://www.googleapis.com/auth/gmail.readonly", access_type: "offline", prompt: "consent", state }).toString();
  const res = NextResponse.redirect(url);
  res.cookies.set("gmail_state", state, { httpOnly: true, secure: origin.startsWith("https"), sameSite: "lax", maxAge: 600, path: "/" });
  return res;
}
