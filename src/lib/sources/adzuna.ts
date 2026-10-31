import { PROFILE } from "@/config/profile";
import { getJson, stripHtml, type NormalizedJob, type Source } from "./types";

type R = { results: { id: string; title: string; company?: { display_name?: string }; location?: { display_name?: string };
  description?: string; redirect_url: string; created?: string; salary_min?: number; salary_max?: number }[] };

export const adzuna: Source = {
  name: "adzuna",
  enabled: () => !!process.env.ADZUNA_APP_ID && !!process.env.ADZUNA_APP_KEY,
  async fetch() {
    const out: NormalizedJob[] = [];
    for (const what of PROFILE.adzunaQueries) for (const where of PROFILE.adzunaWhere) {
      const q = new URLSearchParams({ app_id: process.env.ADZUNA_APP_ID!, app_key: process.env.ADZUNA_APP_KEY!,
        results_per_page: "20", what, max_days_old: "14", "content-type": "application/json" });
      if (where) q.set("where", where);
      const d = await getJson<R>(`https://api.adzuna.com/v1/api/jobs/in/search/1?${q}`);
      for (const j of d.results) out.push({
        source: "adzuna", externalId: String(j.id), company: j.company?.display_name ?? "Unknown", title: j.title,
        location: j.location?.display_name ?? "India", remote: /remote|work from home/i.test(j.title + (j.description ?? "")),
        salaryMin: j.salary_min, salaryMax: j.salary_max, salaryCurrency: "INR",
        description: stripHtml(j.description ?? ""), applyUrl: j.redirect_url, postedAt: j.created,
      });
    }
    return out;
  },
};
