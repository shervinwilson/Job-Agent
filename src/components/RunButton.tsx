"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function RunButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  async function run() {
    setBusy(true); setMsg("");
    try {
      const r = await fetch("/api/cron/discover", { method: "POST" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Run failed");
      setMsg(`Found ${d.inserted} new, scored ${d.scored}, shortlisted ${d.shortlisted}.${d.unscored_remaining ? ` ${d.unscored_remaining} still to score. Run again.` : ""}${d.errors?.length ? ` ${d.errors.length} errors, see logs.` : ""}`);
      router.refresh();
    } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  }
  return (
    <div className="flex items-center gap-3">
      <span role="status" className="text-sm text-ink/70">{msg}</span>
      <button onClick={run} disabled={busy} className="rounded bg-pine px-4 py-2 text-sm font-medium text-white disabled:opacity-60">{busy ? "Searching…" : "Run discovery"}</button>
    </div>
  );
}
