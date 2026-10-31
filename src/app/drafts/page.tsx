import Link from "next/link";
import { DraftCard, type Draft } from "@/components/DraftCard";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Row = { id: string; subject: string; body: string; state: string; error: string | null; gmail_draft_id: string | null;
  jobs: { title: string; apply_url: string | null; companies: { name: string } | null } | null; contacts: { email: string; verified: boolean } | null };

export default async function Drafts() {
  const { data, error } = await supabaseServer().from("emails")
    .select("id,subject,body,state,error,gmail_draft_id,jobs(title,apply_url,companies(name)),contacts(email,verified)").order("created_at", { ascending: false }).limit(100);
  if (error) throw new Error(error.message);
  const drafts: Draft[] = ((data ?? []) as unknown as Row[]).map((r) => ({
    id: r.id, subject: r.subject, body: r.body, state: r.state, error: r.error, company: r.jobs?.companies?.name ?? "Unknown", title: r.jobs?.title ?? "",
    applyUrl: r.jobs?.apply_url ?? null, to: r.contacts?.email ?? null, verified: !!r.contacts?.verified, canSend: !!r.contacts?.verified && !!r.gmail_draft_id }));
  const open = drafts.filter((d) => d.state !== "sent"), sent = drafts.filter((d) => d.state === "sent");
  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <header className="mb-6 flex items-baseline justify-between"><h1 className="text-2xl font-semibold">Emails to review</h1><Link href="/" className="text-sm text-pine underline">Back to dashboard</Link></header>
      {drafts.length === 0 && <p className="text-ink/60">No emails yet. On the dashboard, select Write emails.</p>}
      <div className="space-y-4">{open.map((d) => <DraftCard key={d.id} d={d} />)}</div>
      {sent.length > 0 && <><h2 className="mb-3 mt-10 font-medium">Sent</h2><div className="space-y-4">{sent.map((d) => <DraftCard key={d.id} d={d} />)}</div></>}
    </main>
  );
}
