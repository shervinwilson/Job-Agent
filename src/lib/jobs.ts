import { supabaseServer } from "@/lib/supabase/server";

export const STATUSES = ["discovered","shortlisted","draft_created","approved","email_sent","replied","interview","rejected","manual_apply"] as const;
export const STATUS_LABEL: Record<string, string> = {
  discovered: "Discovered", shortlisted: "Shortlisted", draft_created: "Draft Created", approved: "Approved",
  email_sent: "Email Sent", replied: "Replied", interview: "Interview", rejected: "Rejected", manual_apply: "Manual apply",
};

export type JobRow = {
  id: string; title: string; location: string | null; score: number | null; status: string;
  companies: { name: string; contacts: { email: string; verified: boolean }[] } | null;
};

export async function loadJobs(): Promise<JobRow[]> {
  const { data, error } = await supabaseServer()
    .from("jobs")
    .select("id,title,location,score,status,companies(name,contacts(email,verified))")
    .order("created_at", { ascending: false })
    .limit(2000);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as JobRow[];
}

export const recruiterEmail = (j: JobRow) => {
  const c = j.companies?.contacts ?? [];
  const v = c.find((x) => x.verified);
  return v ? v.email : c[0] ? `${c[0].email} (unverified)` : "";
};

export function applyFilters(rows: JobRow[], q?: string, status?: string, sort?: string, dir?: string) {
  let out = rows;
  if (q) { const s = q.toLowerCase(); out = out.filter((j) => `${j.title} ${j.companies?.name ?? ""} ${j.location ?? ""}`.toLowerCase().includes(s)); }
  if (status) out = out.filter((j) => j.status === status);
  const k = sort ?? "score"; const m = dir === "asc" ? 1 : -1;
  const val = (j: JobRow) => k === "company" ? j.companies?.name ?? "" : k === "title" ? j.title : k === "location" ? j.location ?? "" : k === "status" ? j.status : j.score ?? -1;
  return [...out].sort((a, b) => (val(a) > val(b) ? 1 : val(a) < val(b) ? -1 : 0) * m);
}
