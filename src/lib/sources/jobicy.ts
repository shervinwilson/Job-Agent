import { PROFILE } from "@/config/profile";
import { getJson, stripHtml, type NormalizedJob, type Source } from "./types";

type R = { jobs?: { id: number; url: string; jobTitle: string; companyName: string; jobGeo?: string; jobDescription?: string; jobExcerpt?: string; pubDate?: string }[] };

export const jobicy: Source = {
  name: "jobicy",
  enabled: () => true,
  async fetch() {
    const out: NormalizedJob[] = [];
    for (const tag of PROFILE.jobicyTags) {
      const d = await getJson<R>(`https://jobicy.com/api/v2/remote-jobs?count=50&tag=${encodeURIComponent(tag)}`);
      for (const j of d.jobs ?? []) out.push({ source: "jobicy", externalId: String(j.id), company: j.companyName, title: j.jobTitle,
        location: j.jobGeo || "Remote", remote: true, description: stripHtml(j.jobDescription || j.jobExcerpt || ""), applyUrl: j.url, postedAt: j.pubDate });
    }
    return out;
  },
};
