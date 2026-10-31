"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export type Draft = { id: string; subject: string; body: string; state: string; error: string | null; company: string; title: string;
  applyUrl: string | null; to: string | null; verified: boolean; canSend: boolean };

export function DraftCard({ d }: { d: Draft }) {
  const router = useRouter();
  const [subject, setSubject] = useState(d.subject), [body, setBody] = useState(d.body);
  const [busy, setBusy] = useState(false), [msg, setMsg] = useState(d.error ?? "");
  const sent = d.state === "sent";

  async function act(fn: () => Promise<Response>, ok: string) {
    setBusy(true); setMsg("");
    try { const r = await fn(); const j = await r.json(); if (!r.ok) throw new Error(j.error ?? "Failed"); setMsg(ok); router.refresh(); }
    catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  }
  const send = () => {
    if (confirm(`Send this application to ${d.to}?`)) act(() => fetch(`/api/emails/${d.id}/send`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subject, body }) }), "Sent.");
  };

  return (
    <article className="rounded border border-mist bg-white p-4">
      <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-medium">{d.title} <span className="font-normal text-ink/60">at {d.company}</span></h2>
        <span className="text-sm text-ink/60">{sent ? "Sent" : d.to ? `To ${d.to}${d.verified ? "" : " (unverified)"}` : "No email found"}</span>
      </header>
      <label className="mb-1 block text-sm text-ink/70" htmlFor={`s-${d.id}`}>Subject</label>
      <input id={`s-${d.id}`} value={subject} onChange={(e) => setSubject(e.target.value)} disabled={sent} className="mb-3 w-full rounded border border-mist px-3 py-2 text-sm" />
      <label className="mb-1 block text-sm text-ink/70" htmlFor={`b-${d.id}`}>Message</label>
      <textarea id={`b-${d.id}`} value={body} onChange={(e) => setBody(e.target.value)} disabled={sent} rows={11} className="w-full rounded border border-mist px-3 py-2 text-sm leading-relaxed" />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {!sent && d.canSend && <button onClick={send} disabled={busy} className="rounded bg-pine px-4 py-2 text-sm font-medium text-white disabled:opacity-60">Approve and send</button>}
        {!sent && <button onClick={() => navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`).then(() => setMsg("Copied."))} className="rounded border border-mist px-4 py-2 text-sm">Copy</button>}
        {!sent && d.applyUrl && <a href={d.applyUrl} target="_blank" rel="noreferrer" className="text-sm text-pine underline">Open job page</a>}
        {!sent && <button onClick={() => confirm("Discard this email?") && act(() => fetch(`/api/emails/${d.id}`, { method: "DELETE" }), "Discarded.")} disabled={busy} className="text-sm text-brick underline">Discard</button>}
        <span role="status" className="text-sm text-ink/70">{msg}</span>
      </div>
      {!sent && !d.canSend && <p className="mt-2 text-sm text-ink/60">No verified address for this company, so it can’t be sent from here. Copy the text and apply on the job page.</p>}
    </article>
  );
}
