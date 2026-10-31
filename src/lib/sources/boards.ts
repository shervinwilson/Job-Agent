import { COMPANY_BOARDS } from "@/config/companies";
import { getJson, stripHtml, type NormalizedJob, type Source } from "./types";

type GH = { jobs: { id: number; title: string; location?: { name?: string }; absolute_url: string; updated_at?: string; content?: string }[] };
type LV = { id: string; text: string; categories?: { location?: string }; hostedUrl: string; createdAt?: number; descriptionPlain?: string; workplaceType?: string }[];

export const boards: Source = {
  name: "company_boards",
  enabled: () => COMPANY_BOARDS.length > 0,
  async fetch() {
    const out: NormalizedJob[] = [];
    for (const b of COMPANY_BOARDS) {
      if (b.ats === "greenhouse") {
        const d = await getJson<GH>(`https://boards-api.greenhouse.io/v1/boards/${b.slug}/jobs?content=true`);
        for (const j of d.jobs) out.push({ source: `greenhouse`, externalId: `${b.slug}-${j.id}`, company: b.name, title: j.title,
          location: j.location?.name ?? "Unknown", remote: /remote/i.test(j.location?.name ?? ""),
          description: stripHtml(stripHtml(j.content ?? "")), applyUrl: j.absolute_url, postedAt: j.updated_at });
      } else {
        const d = await getJson<LV>(`https://api.lever.co/v0/postings/${b.slug}?mode=json`);
        for (const j of d) out.push({ source: "lever", externalId: `${b.slug}-${j.id}`, company: b.name, title: j.text,
          location: j.categories?.location ?? "Unknown", remote: j.workplaceType === "remote" || /remote/i.test(j.categories?.location ?? ""),
          description: j.descriptionPlain ?? "", applyUrl: j.hostedUrl, postedAt: j.createdAt ? new Date(j.createdAt).toISOString() : undefined });
      }
    }
    return out;
  },
};
