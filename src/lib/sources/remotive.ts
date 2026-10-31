import { PROFILE } from "@/config/profile";
import { getJson, stripHtml, type NormalizedJob, type Source } from "./types";

type R = { jobs: { id: number; url: string; title: string; company_name: string; candidate_required_location?: string;
  publication_date?: string; description?: string }[] };

// Remotive asks for at most a few requests a day and for attribution (see README).
export const remotive: Source = {
  name: "remotive",
  enabled: () => true,
  async fetch() {
    const out: NormalizedJob[] = [];
    for (const s of PROFILE.remotiveQueries) {
      const d = await getJson<R>(`https://remotive.com/api/remote-jobs?category=software-dev&search=${encodeURIComponent(s)}&limit=30`);
      for (const j of d.jobs) out.push({
        source: "remotive", externalId: String(j.id), company: j.company_name, title: j.title,
        location: j.candidate_required_location || "Remote", remote: true,
        description: stripHtml(j.description ?? ""), applyUrl: j.url, postedAt: j.publication_date,
      });
    }
    return out;
  },
};
