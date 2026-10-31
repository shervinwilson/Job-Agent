import { promises as dns } from "dns";

export type Verdict = { verified: boolean; result: string; service: string };
export const hasVerifierKey = () => !!(process.env.REOON_API_KEY || process.env.HUNTER_API_KEY);

// "verified" is true only when a real verification service confirms the mailbox.
// Without a key we still check that the domain accepts mail (MX), but that stays unverified.
export async function verifyEmail(email: string): Promise<Verdict> {
  const domain = email.split("@")[1];
  try {
    const mx = await dns.resolveMx(domain);
    if (!mx.length) return { verified: false, result: "no_mx", service: "dns" };
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code === "ENODATA" || code === "ENOTFOUND") return { verified: false, result: "no_mx", service: "dns" };
  }
  try {
    if (process.env.REOON_API_KEY) {
      const q = new URLSearchParams({ email, key: process.env.REOON_API_KEY, mode: "quick" });
      const r = await fetch(`https://emailverifier.reoon.com/api/v1/verify?${q}`, { cache: "no-store" });
      if (!r.ok) throw new Error(`Reoon responded ${r.status}`);
      const s = String((await r.json()).status ?? "unknown").toLowerCase();
      return { verified: ["valid", "safe", "role_account"].includes(s), result: s, service: "reoon" };
    }
    if (process.env.HUNTER_API_KEY) {
      const q = new URLSearchParams({ email, api_key: process.env.HUNTER_API_KEY });
      const r = await fetch(`https://api.hunter.io/v2/email-verifier?${q}`, { cache: "no-store" });
      if (!r.ok) throw new Error(`Hunter responded ${r.status}`);
      const s = String((await r.json()).data?.status ?? "unknown").toLowerCase();
      return { verified: s === "valid", result: s, service: "hunter" };
    }
  } catch (e) {
    return { verified: false, result: `error: ${(e as Error).message}`, service: "verifier" };
  }
  return { verified: false, result: "mx_only", service: "dns" };
}
