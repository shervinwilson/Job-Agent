import { supabaseAdmin } from "@/lib/supabase/admin";
import { askLLM } from "@/lib/scoring";
import { hasVerifierKey, verifyEmail } from "@/lib/verify";

const UA = "job-agent/0.1 (personal job-search tool)";
const BOARD_LABELS = new Set(["adzuna", "remotive", "remoteok", "jobicy", "greenhouse", "lever", "linkedin", "indeed", "naukri", "glassdoor",
  "ashbyhq", "workable", "myworkdayjobs", "smartrecruiters", "jobvite", "icims", "bamboohr", "recruitee", "wellfound", "instahyre", "cutshort",
  "foundit", "monster", "ziprecruiter", "himalayas", "weworkremotely", "jooble", "careerjet", "simplyhired", "google", "rapidapi", "workatastartup"]);
const TWO_PART_TLDS = new Set(["co.in", "co.uk", "com.au", "co.nz", "com.sg", "co.za", "com.br", "org.in", "net.in", "ac.in", "org.uk"]);
const PATHS = ["/careers", "/jobs", "/contact", "/contact-us", "/about", "/about-us", "/team"];
const BAD_LOCAL = /^(no-?reply|do-?not-?reply|privacy|abuse|legal|security|dpo|press|webmaster|unsubscribe|postmaster|sales|billing|accounts?)$/i;
const GOOD_LOCAL = /^(careers?|jobs?|hr|hiring|recruit\w*|talent|people|join|work)$/i;
const SOFT_LOCAL = /^(contact|hello|info|team|office|hi)$/i;

export function registrableDomain(host: string) {
  const l = host.toLowerCase().replace(/^www\./, "").split(".");
  const last2 = l.slice(-2).join(".");
  return l.length >= 3 && TWO_PART_TLDS.has(last2) ? l.slice(-3).join(".") : l.slice(-2).join(".");
}
const validDomain = (d: string) => /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(d) && !/^\d+(\.\d+)+$/.test(d);
const isBoardHost = (host: string) => host.toLowerCase().split(".").some((p) => BOARD_LABELS.has(p));

async function fetchText(url: string, ms = 6000): Promise<string | null> {
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), ms);
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html,*/*" }, signal: ac.signal, redirect: "follow", cache: "no-store" });
    if (!r.ok || !/text|html|xml/.test(r.headers.get("content-type") ?? "")) return null;
    return (await r.text()).slice(0, 400_000);
  } catch { return null; } finally { clearTimeout(t); }
}

async function robotsDisallows(domain: string): Promise<string[]> {
  const txt = await fetchText(`https://${domain}/robots.txt`, 3000);
  if (!txt) return [];
  const out: string[] = []; let applies = false;
  for (const raw of txt.split(/\r?\n/)) {
    const m = raw.split("#")[0].trim().match(/^([a-z-]+)\s*:\s*(.*)$/i);
    if (!m) continue;
    const k = m[1].toLowerCase(), v = m[2].trim();
    if (k === "user-agent") applies = v === "*";
    else if (applies && k === "disallow" && v) out.push(v);
  }
  return out;
}

const coreName = (n: string) => n.toLowerCase().replace(/\b(pvt|private|ltd|limited|inc|llc|llp|corp|corporation|technologies|technology|solutions|software|systems|india|labs|co)\b/g, " ").replace(/[^a-z0-9]+/g, "");
const nameMatches = (html: string, company: string) => {
  const core = coreName(company) || company.toLowerCase().replace(/[^a-z0-9]+/g, "");
  return core.length >= 3 && html.toLowerCase().replace(/[^a-z0-9]+/g, "").includes(core);
};

export function extractEmails(html: string, domain: string) {
  const found = new Set<string>();
  for (const m of html.matchAll(/mailto:([^"'?>\s]+)/gi)) found.add(decodeURIComponent(m[1]).toLowerCase());
  for (const m of html.matchAll(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi)) found.add(m[0].toLowerCase());
  return [...found].filter((e) => {
    const [local, host] = e.split("@");
    if (!local || !host || /\.(png|jpe?g|gif|webp|svg|css|js)$/.test(host)) return false;
    return (host === domain || host.endsWith("." + domain)) && !BAD_LOCAL.test(local);
  });
}
const rank = (e: string) => { const l = e.split("@")[0]; return GOOD_LOCAL.test(l) ? 3 : SOFT_LOCAL.test(l) ? 1 : 2; };

async function findDomain(c: { name: string; domain: string | null; website: string | null }, applyUrls: string[], hint: string) {
  const cands: string[] = [];
  if (c.domain) cands.push(c.domain);
  if (c.website) { try { cands.push(registrableDomain(new URL(c.website).hostname)); } catch {} }
  for (const u of applyUrls) { try { const h = new URL(u).hostname; if (!isBoardHost(h)) cands.push(registrableDomain(h)); } catch {} }
  try {
    const a = await askLLM(`What is the official website domain of the company "${c.name}" (hiring: ${hint})? Return ONLY JSON {"domain":"example.com"}, or {"domain":null} if you are not sure.`);
    const d = a ? JSON.parse(a.slice(a.indexOf("{"), a.lastIndexOf("}") + 1)).domain : null;
    if (typeof d === "string") cands.push(registrableDomain(d.replace(/^https?:\/\//, "").split("/")[0]));
  } catch { /* no AI key or bad answer: skip */ }
  for (const d of [...new Set(cands)].filter(validDomain)) {
    const html = (await fetchText(`https://${d}`)) ?? (await fetchText(`https://www.${d}`));
    if (html && nameMatches(html, c.name)) return d; // the site must actually mention the company
  }
  return null;
}

type Co = { id: string; name: string; domain: string | null; website: string | null };

async function processCompany(co: Co, applyUrls: string[], hint: string) {
  const db = supabaseAdmin();
  const domain = await findDomain(co, applyUrls, hint);
  const emailPage = new Map<string, string>();
  if (domain) {
    const blocked = await robotsDisallows(domain);
    const paths = PATHS.filter((p) => !blocked.some((b) => p.startsWith(b)));
    const pages = await Promise.all(["/", ...paths].map(async (p) => ({ url: `https://${domain}${p}`, html: await fetchText(`https://${domain}${p}`) })));
    for (const pg of pages) if (pg.html) for (const e of extractEmails(pg.html, domain)) if (!emailPage.has(e)) emailPage.set(e, pg.url);
  }
  const ranked = [...emailPage.keys()].sort((a, b) => rank(b) - rank(a)).slice(0, 3);
  const maxChecks = hasVerifierKey() ? 2 : 3; // free verifier quotas are small
  let verifiedCount = 0, checks = 0; const rows = [];
  for (const email of ranked) {
    let v = { verified: false, result: "not_checked", service: "none" };
    if (checks < maxChecks && verifiedCount === 0) { v = await verifyEmail(email); checks++; }
    if (v.verified) verifiedCount++;
    rows.push({ company_id: co.id, email, source_url: emailPage.get(email), role: null, verified: v.verified, verification_result: `${v.service}:${v.result}`, verified_at: v.verified ? new Date().toISOString() : null });
  }
  if (rows.length) await db.from("contacts").upsert(rows, { onConflict: "company_id,email" });
  const upd = await db.from("companies").update({ contacts_checked_at: new Date().toISOString(), ...(domain ? { domain, website: `https://${domain}` } : {}) }).eq("id", co.id);
  if (upd.error && domain) await db.from("companies").update({ contacts_checked_at: new Date().toISOString(), website: `https://${domain}` }).eq("id", co.id);
  if (verifiedCount === 0) await db.from("jobs").update({ status: "manual_apply" }).eq("company_id", co.id).eq("status", "shortlisted");
  return { company: co.name, domain, found: ranked.length, verified: verifiedCount };
}

export async function runContactDiscovery(limit = 4) {
  const db = supabaseAdmin();
  const { data } = await db.from("jobs").select("title,location,apply_url,companies(id,name,domain,website,contacts_checked_at)")
    .eq("status", "shortlisted").order("score", { ascending: false }).limit(200);
  const byCo = new Map<string, { co: Co; urls: string[]; hint: string }>();
  for (const j of (data ?? []) as unknown as { title: string; location: string | null; apply_url: string | null; companies: (Co & { contacts_checked_at: string | null }) | null }[]) {
    const c = j.companies; if (!c || c.contacts_checked_at) continue;
    const e = byCo.get(c.id) ?? { co: c, urls: [], hint: `${j.title}, ${j.location ?? ""}` };
    if (j.apply_url) e.urls.push(j.apply_url);
    byCo.set(c.id, e);
  }
  const todo = [...byCo.values()]; const batch = todo.slice(0, limit);
  const results: Awaited<ReturnType<typeof processCompany>>[] = []; const errors: string[] = [];
  const queue = [...batch];
  await Promise.all([0, 1].map(async () => {
    for (let t = queue.shift(); t; t = queue.shift()) {
      try { results.push(await processCompany(t.co, t.urls, t.hint)); }
      catch (e) { errors.push(`${t.co.name}: ${(e as Error).message}`); }
    }
  }));
  return { checked: results.length, withVerified: results.filter((r) => r.verified > 0).length,
    foundUnverified: results.filter((r) => r.verified === 0 && r.found > 0).length, noEmail: results.filter((r) => r.found === 0).length,
    remaining: todo.length - batch.length, errors, results };
}
