export type NormalizedJob = {
  source: string; externalId: string; company: string; title: string;
  location: string; remote: boolean; salaryMin?: number; salaryMax?: number; salaryCurrency?: string;
  description: string; applyUrl: string; postedAt?: string;
};
export type Source = { name: string; enabled: () => boolean; fetch: () => Promise<NormalizedJob[]> };

export const stripHtml = (h: string) =>
  h.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;|&quot;/g, "'").replace(/\s+/g, " ").trim();

export async function getJson<T>(url: string, headers: Record<string, string> = {}): Promise<T> {
  const r = await fetch(url, { headers: { Accept: "application/json", ...headers }, cache: "no-store" });
  if (!r.ok) throw new Error(`${new URL(url).hostname} responded ${r.status}`);
  return r.json() as Promise<T>;
}
