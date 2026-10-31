import { createHash } from "crypto";
import { PROFILE } from "@/config/profile";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { scoreJob } from "@/lib/scoring";
import { adzuna } from "@/lib/sources/adzuna";
import { jsearch } from "@/lib/sources/jsearch";
import { remotive } from "@/lib/sources/remotive";
import { remoteok } from "@/lib/sources/remoteok";
import { jobicy } from "@/lib/sources/jobicy";
import { boards } from "@/lib/sources/boards";
import type { NormalizedJob } from "@/lib/sources/types";

const SOURCES = [adzuna, jsearch, remotive, remoteok, jobicy, boards];
const SCORE_BATCH = 20, CONCURRENCY = 2;

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
export const dedupeHash = (company: string, title: string) => createHash("sha256").update(`${norm(company)}|${norm(title)}`).digest("hex");

export async function runDiscovery() {
  const db = supabaseAdmin();
  const { data: run, error: runErr } = await db.from("runs").insert({}).select("id").single();
  if (runErr || !run) throw new Error(`Could not start run: ${runErr?.message}`);
  const errors: string[] = [];
  const log = (level: string, message: string, meta?: object) => db.from("logs").insert({ run_id: run.id, level, message, meta });

  // 1. Fetch from every enabled source; one failing source never stops the others
  const jobs: NormalizedJob[] = [];
  await Promise.all(SOURCES.filter((s) => s.enabled()).map(async (s) => {
    try { const r = await s.fetch(); jobs.push(...r); await log("info", `${s.name}: ${r.length} jobs`); }
    catch (e) { const m = `${s.name}: ${(e as Error).message}`; errors.push(m); await log("error", m); }
  }));

  // 2. Keep only relevant, recent, non-intern titles
  const cutoff = Date.now() - PROFILE.maxAgeDays * 864e5;
  const relevant = jobs.filter((j) => j.title && j.company && PROFILE.titleKeywords.test(j.title) && !PROFILE.excludeTitle.test(j.title)
    && (!j.postedAt || isNaN(+new Date(j.postedAt)) || +new Date(j.postedAt) >= cutoff));

  // 3. Resolve companies, then insert; the unique dedupe_hash drops duplicates
  const companyIds = new Map<string, string>();
  for (const name of new Set(relevant.map((j) => j.company))) {
    const { data: found } = await db.from("companies").select("id").ilike("name", name.replace(/[%_]/g, "\\$&")).maybeSingle();
    if (found) { companyIds.set(name, found.id); continue; }
    const { data: created, error } = await db.from("companies").insert({ name }).select("id").single();
    if (created) companyIds.set(name, created.id);
    else if (error) {
      const { data: again } = await db.from("companies").select("id").ilike("name", name.replace(/[%_]/g, "\\$&")).maybeSingle();
      if (again) companyIds.set(name, again.id);
    }
  }
  const rows = relevant.filter((j) => companyIds.has(j.company)).map((j) => ({
    source: j.source, external_id: j.externalId, company_id: companyIds.get(j.company), title: j.title, location: j.location, remote: j.remote,
    salary_min: j.salaryMin ? Math.round(j.salaryMin) : null, salary_max: j.salaryMax ? Math.round(j.salaryMax) : null,
    description: j.description, apply_url: j.applyUrl, posted_at: j.postedAt && !isNaN(+new Date(j.postedAt)) ? new Date(j.postedAt).toISOString() : null,
    dedupe_hash: dedupeHash(j.company, j.title), _currency: j.salaryCurrency,
  }));
  const unique = [...new Map(rows.map((r) => [r.dedupe_hash, r])).values()].map(({ _currency, ...r }) => r);
  let inserted = 0;
  for (let i = 0; i < unique.length; i += 100) {
    const { data, error } = await db.from("jobs").upsert(unique.slice(i, i + 100), { onConflict: "dedupe_hash", ignoreDuplicates: true }).select("id");
    if (error) { errors.push(`insert: ${error.message}`); await log("error", `insert: ${error.message}`); } else inserted += data?.length ?? 0;
  }

  // 4. Score a batch of unscored jobs (rules + Claude)
  const { data: pending } = await db.from("jobs").select("id,title,location,remote,description,salary_min,salary_max,source,companies(name)")
    .is("score", null).eq("is_active", true).order("created_at", { ascending: false }).limit(SCORE_BATCH);
  let scored = 0, shortlisted = 0;
  const queue = [...(pending ?? [])];
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    for (let j = queue.shift(); j; j = queue.shift()) {
      try {
        const company = (j.companies as unknown as { name: string } | null)?.name ?? "Unknown";
        const { score, breakdown } = await scoreJob({ title: j.title, company, location: j.location ?? "", remote: !!j.remote,
          description: j.description ?? "", salaryMin: j.salary_min ?? undefined, salaryMax: j.salary_max ?? undefined,
          salaryCurrency: j.source === "adzuna" ? "INR" : undefined });
        const status = score >= 70 ? "shortlisted" : "discovered";
        await db.from("jobs").update({ score, score_breakdown: breakdown, status }).eq("id", j.id);
        scored++; if (status === "shortlisted") shortlisted++;
      } catch (e) { const m = `score ${j.id}: ${(e as Error).message}`; errors.push(m); await log("error", m); }
    }
  }));
  const { count: remaining } = await db.from("jobs").select("id", { count: "exact", head: true }).is("score", null).eq("is_active", true);

  const summary = { found: jobs.length, relevant: relevant.length, inserted, scored, shortlisted, unscored_remaining: remaining ?? 0, errors };
  await db.from("runs").update({ finished_at: new Date().toISOString(), jobs_found: inserted, shortlisted, errors }).eq("id", run.id);
  return summary;
}
