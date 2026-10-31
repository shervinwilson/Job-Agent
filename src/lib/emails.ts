import { supabaseAdmin } from "@/lib/supabase/admin";
import { aiProvider, askLLM } from "@/lib/scoring";
import { PROFILE } from "@/config/profile";
import { createDraft, deleteDraft, sendDraft, updateDraft } from "@/lib/gmail";

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

type Contact = { id: string; name: string | null; email: string; verified: boolean };
type JobCtx = { id: string; title: string; location: string | null; description: string | null; status: string; company_id: string;
  companies: { id: string; name: string; contacts_checked_at: string | null; contacts: Contact[] } | null };

function prompt(j: JobCtx, contact: Contact | undefined) {
  const company = j.companies!.name;
  const greeting = contact?.name ? `Hi ${contact.name.split(" ")[0]},` : `Hello ${company} hiring team,`;
  return `Write a job application email.

Candidate: ${process.env.CANDIDATE_NAME || "the candidate"}, a web developer with 3+ years of experience. Skills: HTML5, CSS3, JavaScript, React.js, Next.js, TypeScript (basic), WordPress, Elementor, Divi, responsive design, SEO (Rank Math), website optimization, Git and GitHub. Notice period: ${PROFILE.noticePeriod} (mention once, briefly).
Portfolio: ${process.env.PORTFOLIO_URL || "(none)"}
Resume: ${process.env.RESUME_URL || "(none)"}

Job: ${j.title} at ${company} (${j.location ?? "location not stated"})
Description: ${(j.description ?? "").slice(0, 3000)}

Rules:
- Body is 100 to 180 words, plain text, no markdown.
- Start with exactly: ${greeting}
- Mention the 2-3 skills that best match this job description, and one sentence on why this role or company is interesting, based ONLY on the description.
- Do not invent experience, projects, numbers, employers or facts about the company. Do not discuss salary.
- Put the portfolio and resume links on their own lines (skip a link marked none).
- End with a professional closing and the candidate's name.
- Subject like "Application for ${j.title} – React.js / Next.js Experience", adapted to the job's real stack.

Return ONLY JSON: {"subject": "...", "body": "..."}`;
}

async function writeEmail(j: JobCtx, contact: Contact | undefined) {
  let last = { subject: "", body: "" };
  for (let i = 0; i < 2; i++) {
    const t = await askLLM(prompt(j, contact));
    if (!t) throw new Error("Add GEMINI_API_KEY to write emails.");
    const p = JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1));
    last = { subject: String(p.subject ?? "").trim(), body: String(p.body ?? "").trim() };
    const n = words(last.body);
    if (last.subject && n >= 95 && n <= 195) break;
  }
  if (!last.subject || !last.body) throw new Error("The AI returned an empty email");
  return last;
}

export async function generateEmails(limit = 3) {
  if (aiProvider() === "none") throw new Error("Add GEMINI_API_KEY to write emails.");
  const db = supabaseAdmin();
  const { data } = await db.from("jobs").select("id,title,location,description,status,company_id,companies(id,name,contacts_checked_at,contacts(id,name,email,verified))")
    .in("status", ["shortlisted", "manual_apply"]).gte("score", 70).order("score", { ascending: false }).limit(60);
  const { data: have } = await db.from("emails").select("job_id");
  const { data: apps } = await db.from("applications").select("company_id,normalized_title");
  const haveSet = new Set((have ?? []).map((e) => e.job_id));
  const appSet = new Set((apps ?? []).map((a) => `${a.company_id}|${a.normalized_title}`));
  const todo = ((data ?? []) as unknown as JobCtx[]).filter((j) => j.companies?.contacts_checked_at && !haveSet.has(j.id) && !appSet.has(`${j.company_id}|${norm(j.title)}`));
  const out = { drafts: 0, textOnly: 0, remaining: Math.max(0, todo.length - limit), errors: [] as string[] };
  for (const j of todo.slice(0, limit)) {
    try {
      const contacts = j.companies!.contacts ?? [];
      const verified = contacts.find((c) => c.verified);
      const mail = await writeEmail(j, verified);
      let draftId: string | null = null;
      if (verified) draftId = (await createDraft(verified.email, mail.subject, mail.body)).id;
      const { error } = await db.from("emails").insert({ job_id: j.id, contact_id: (verified ?? contacts[0])?.id ?? null, subject: mail.subject, body: mail.body, gmail_draft_id: draftId, state: "draft" });
      if (error) { if (draftId) await deleteDraft(draftId).catch(() => {}); throw new Error(error.message); }
      if (verified) { await db.from("jobs").update({ status: "draft_created" }).eq("id", j.id); out.drafts++; } else out.textOnly++;
    } catch (e) { out.errors.push(`${j.companies?.name}: ${(e as Error).message}`); if (/Gmail is not connected|expired/.test((e as Error).message)) break; }
  }
  return out;
}

function istDayStart() {
  const d = new Date(Date.now() + 5.5 * 3600e3); d.setUTCHours(0, 0, 0, 0);
  return new Date(d.getTime() - 5.5 * 3600e3).toISOString();
}

export async function sendEmail(id: string, subject: string, body: string) {
  const db = supabaseAdmin();
  const { data: e } = await db.from("emails").select("id,state,gmail_draft_id,job_id,jobs(id,title,company_id),contacts(email,verified)").eq("id", id).single();
  if (!e) throw new Error("Email not found");
  const job = e.jobs as unknown as { id: string; title: string; company_id: string } | null;
  const contact = e.contacts as unknown as { email: string; verified: boolean } | null;
  if (!["draft", "approved", "failed"].includes(e.state)) throw new Error("This email was already sent");
  if (!contact?.verified || !e.gmail_draft_id || !job) throw new Error("Only emails to verified addresses can be sent. Copy this one and apply manually.");
  if (!subject.trim() || !body.trim()) throw new Error("Subject and body cannot be empty");

  const { data: st } = await db.from("settings").select("daily_send_limit").eq("id", 1).single();
  const { count } = await db.from("emails").select("id", { count: "exact", head: true }).eq("state", "sent").gte("sent_at", istDayStart());
  if ((count ?? 0) >= (st?.daily_send_limit ?? 15)) throw new Error(`Daily send limit of ${st?.daily_send_limit ?? 15} reached. It resets at midnight IST.`);

  const appRow = { job_id: job.id, company_id: job.company_id, normalized_title: norm(job.title) };
  const ins = await db.from("applications").insert(appRow).select("id").single();
  if (ins.error) throw new Error(ins.error.code === "23505" ? "You already applied to this company for this role." : ins.error.message);

  await db.from("jobs").update({ status: "approved" }).eq("id", job.id);
  try {
    await updateDraft(e.gmail_draft_id, contact.email, subject, body);
    const sent = await sendDraft(e.gmail_draft_id);
    await db.from("emails").update({ state: "sent", subject, body, gmail_message_id: sent.id, gmail_thread_id: sent.threadId, sent_at: new Date().toISOString(), error: null }).eq("id", id);
    await db.from("jobs").update({ status: "email_sent" }).eq("id", job.id);
  } catch (err) {
    await db.from("applications").delete().eq("id", ins.data.id);
    await db.from("emails").update({ state: "failed", error: (err as Error).message }).eq("id", id);
    await db.from("jobs").update({ status: "draft_created" }).eq("id", job.id);
    throw err;
  }
}

export async function discardEmail(id: string) {
  const db = supabaseAdmin();
  const { data: e } = await db.from("emails").select("state,gmail_draft_id,job_id,jobs(status)").eq("id", id).single();
  if (!e) return;
  if (e.state === "sent") throw new Error("A sent email cannot be discarded");
  if (e.gmail_draft_id) await deleteDraft(e.gmail_draft_id).catch(() => {});
  await db.from("emails").delete().eq("id", id);
  const st = (e.jobs as unknown as { status: string } | null)?.status;
  if (st === "draft_created" || st === "approved") await db.from("jobs").update({ status: "shortlisted" }).eq("id", e.job_id);
}
