import { supabaseAdmin } from "@/lib/supabase/admin";
import { decrypt } from "@/lib/crypto";

const API = "https://gmail.googleapis.com/gmail/v1/users/me";
let cached: { token: string; exp: number } | null = null;

export async function getAccessToken() {
  if (cached && cached.exp > Date.now() + 30_000) return cached.token;
  const { data } = await supabaseAdmin().from("oauth_tokens").select("encrypted_refresh_token").eq("provider", "google").maybeSingle();
  if (!data) throw new Error("Gmail is not connected. Select Connect Gmail on the dashboard.");
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: decrypt(data.encrypted_refresh_token), grant_type: "refresh_token" }) });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error === "invalid_grant" ? "Gmail connection expired. Select Connect Gmail again." : `Google token error: ${j.error ?? r.status}`);
  cached = { token: j.access_token, exp: Date.now() + j.expires_in * 1000 };
  return cached.token;
}

const clean = (s: string) => s.replace(/[\r\n]+/g, " ").trim();
export function buildRaw(to: string, subject: string, body: string) {
  const subj = clean(subject);
  const encSubj = /^[\x20-\x7e]*$/.test(subj) ? subj : `=?UTF-8?B?${Buffer.from(subj).toString("base64")}?=`;
  const b64 = Buffer.from(body.replace(/\r?\n/g, "\r\n")).toString("base64").replace(/(.{76})/g, "$1\r\n");
  return Buffer.from([`To: ${clean(to)}`, `Subject: ${encSubj}`, "MIME-Version: 1.0", 'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64", "", b64].join("\r\n")).toString("base64url");
}

async function call<T>(path: string, method: string, body?: object): Promise<T> {
  const r = await fetch(`${API}${path}`, { method, headers: { Authorization: `Bearer ${await getAccessToken()}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined });
  if (!r.ok) throw new Error(`Gmail error ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return (r.status === 204 ? {} : await r.json()) as T;
}
export const createDraft = (to: string, subject: string, body: string) =>
  call<{ id: string }>("/drafts", "POST", { message: { raw: buildRaw(to, subject, body) } });
export const updateDraft = (id: string, to: string, subject: string, body: string) =>
  call<{ id: string }>(`/drafts/${id}`, "PUT", { message: { raw: buildRaw(to, subject, body) } });
export const sendDraft = (id: string) => call<{ id: string; threadId: string }>("/drafts/send", "POST", { id });
export const deleteDraft = (id: string) => call<object>(`/drafts/${id}`, "DELETE");
