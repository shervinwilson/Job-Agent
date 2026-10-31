import { getJson, stripHtml, type NormalizedJob, type Source } from "./types";

type J = { id?: string; position?: string; company?: string; location?: string; description?: string; url?: string; date?: string; salary_min?: number; salary_max?: number };

// RemoteOK requires a visible link back to remoteok.com (see README).
export const remoteok: Source = {
  name: "remoteok",
  enabled: () => true,
  async fetch() {
    const d = await getJson<J[]>("https://remoteok.com/api", { "User-Agent": "job-agent personal tool" });
    const out: NormalizedJob[] = [];
    for (const j of d) {
      if (!j.id || !j.position || !j.company) continue; // first element is a legal notice
      out.push({ source: "remoteok", externalId: String(j.id), company: j.company, title: j.position, location: j.location || "Remote", remote: true,
        salaryMin: j.salary_min || undefined, salaryMax: j.salary_max || undefined, salaryCurrency: j.salary_max ? "USD" : undefined,
        description: stripHtml(j.description ?? ""), applyUrl: j.url ?? "", postedAt: j.date });
    }
    return out;
  },
};
