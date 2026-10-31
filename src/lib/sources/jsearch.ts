import { PROFILE } from "@/config/profile";
import { getJson, stripHtml, type NormalizedJob, type Source } from "./types";

type R = { data: { job_id: string; job_title: string; employer_name?: string; job_city?: string; job_state?: string; job_country?: string;
  job_is_remote?: boolean; job_description?: string; job_apply_link?: string; job_posted_at_datetime_utc?: string;
  job_min_salary?: number; job_max_salary?: number; job_salary_currency?: string }[] };

export const jsearch: Source = {
  name: "jsearch",
  enabled: () => !!process.env.RAPIDAPI_KEY,
  async fetch() {
    const out: NormalizedJob[] = [];
    for (const query of PROFILE.jsearchQueries) {
      const q = new URLSearchParams({ query, page: "1", num_pages: "1", date_posted: "week" });
      const d = await getJson<R>(`https://jsearch.p.rapidapi.com/search?${q}`, {
        "X-RapidAPI-Key": process.env.RAPIDAPI_KEY!, "X-RapidAPI-Host": "jsearch.p.rapidapi.com" });
      for (const j of d.data ?? []) out.push({
        source: "jsearch", externalId: j.job_id, company: j.employer_name ?? "Unknown", title: j.job_title,
        location: [j.job_city, j.job_state, j.job_country].filter(Boolean).join(", ") || "Unknown",
        remote: !!j.job_is_remote, salaryMin: j.job_min_salary, salaryMax: j.job_max_salary, salaryCurrency: j.job_salary_currency,
        description: stripHtml(j.job_description ?? ""), applyUrl: j.job_apply_link ?? "", postedAt: j.job_posted_at_datetime_utc,
      });
    }
    return out;
  },
};
