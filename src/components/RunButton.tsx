"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

const CFG = {
  discover: { url: "/api/cron/discover", label: "Run discovery", busy: "Searching…",
    fmt: (d: any) => `Found ${d.inserted} new, scored ${d.scored}, shortlisted ${d.shortlisted}.${d.unscored_remaining ? ` ${d.unscored_remaining} still to score. Run again.` : ""}${d.errors?.length ? ` ${d.errors.length} errors, see logs.` : ""}` },
  contacts: { url: "/api/contacts/discover", label: "Find contacts", busy: "Checking sites…",
    fmt: (d: any) => `Checked ${d.checked} companies: ${d.withVerified} verified, ${d.foundUnverified} unverified, ${d.noEmail} with no public email.${d.remaining ? ` ${d.remaining} left. Run again.` : ""}${d.errors?.length ? ` ${d.errors.length} errors.` : ""}` },
  emails: { url: "/api/emails/generate", label: "Write emails", busy: "Writing…",
    fmt: (d: any) => `Wrote ${d.drafts} Gmail drafts and ${d.textOnly} copy-only emails.${d.remaining ? ` ${d.remaining} left. Run again.` : ""}${d.errors?.length ? ` ${d.errors[0]}` : ""}` },
};

export function RunButton({ kind = "discover" }: { kind?: "discover" | "contacts" | "emails" }) {
  const cfg = CFG[kind];
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  async function run() {
    setBusy(true); setMsg("");
    try {
      const r = await fetch(cfg.url, { method: "POST" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Run failed");
      setMsg(cfg.fmt(d)); router.refresh();
    } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  }
  return (
    <div className="flex items-center gap-3">
      <span role="status" className="max-w-xs text-sm text-ink/70">{msg}</span>
      <button onClick={run} disabled={busy} className="rounded bg-pine px-4 py-2 text-sm font-medium text-white disabled:opacity-60">{busy ? cfg.busy : cfg.label}</button>
    </div>
  );
}
