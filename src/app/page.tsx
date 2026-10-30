import { applyFilters, loadJobs, recruiterEmail, STATUSES, STATUS_LABEL } from "@/lib/jobs";

type SP = { q?: string; status?: string; sort?: string; dir?: string };
const TONE: Record<string, string> = { shortlisted: "bg-pine/10 text-pine", draft_created: "bg-amber/15 text-amber", rejected: "bg-brick/10 text-brick", email_sent: "bg-ink/10 text-ink" };

export default async function Dashboard({ searchParams }: { searchParams: SP }) {
  const all = await loadJobs();
  const rows = applyFilters(all, searchParams.q, searchParams.status, searchParams.sort, searchParams.dir);
  const n = (s: string[]) => all.filter((j) => s.includes(j.status)).length;
  const stats = [
    ["Jobs discovered", all.length],
    ["Shortlisted", all.filter((j) => (j.score ?? 0) >= 70).length],
    ["Awaiting approval", n(["draft_created"])],
    ["Emails sent", n(["email_sent", "replied", "interview"])],
  ] as const;
  const byLocation = Object.entries(all.reduce<Record<string, number>>((a, j) => { const k = j.location || "Unknown"; a[k] = (a[k] ?? 0) + 1; return a; }, {})).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const byCompany = Object.entries(all.filter((j) => j.status !== "discovered").reduce<Record<string, number>>((a, j) => { const k = j.companies?.name ?? "Unknown"; a[k] = (a[k] ?? 0) + 1; return a; }, {})).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const qs = new URLSearchParams(Object.entries(searchParams).filter(([, v]) => v) as [string, string][]).toString();
  const sortLink = (k: string) => `/?${new URLSearchParams({ ...searchParams, sort: k, dir: searchParams.sort === k && searchParams.dir !== "asc" ? "asc" : "desc" })}`;

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <header className="mb-6 flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Job Agent</h1>
        <a href={`/api/export?${qs}`} className="text-sm text-pine underline">Export CSV</a>
      </header>

      <dl className="mb-8 grid grid-cols-2 gap-x-8 gap-y-4 border-b border-mist pb-6 md:grid-cols-4">
        {stats.map(([label, v]) => (<div key={label}><dd className="text-3xl font-semibold tabular-nums">{v}</dd><dt className="text-sm text-ink/60">{label}</dt></div>))}
      </dl>

      <div className="mb-8 grid gap-8 md:grid-cols-2">
        {[["Jobs by location", byLocation], ["Applications by company", byCompany]].map(([title, list]) => (
          <section key={title as string}>
            <h2 className="mb-2 text-sm font-medium">{title as string}</h2>
            {(list as [string, number][]).length === 0 ? <p className="text-sm text-ink/60">Nothing yet.</p> :
              <ul className="space-y-1 text-sm">{(list as [string, number][]).map(([k, v]) => (<li key={k} className="flex justify-between border-b border-mist py-1"><span>{k}</span><span className="tabular-nums">{v}</span></li>))}</ul>}
          </section>
        ))}
      </div>

      <form className="mb-3 flex flex-wrap gap-2" role="search">
        <input name="q" defaultValue={searchParams.q} placeholder="Search company, title, location" aria-label="Search jobs" className="min-w-64 flex-1 rounded border border-mist bg-white px-3 py-2 text-sm" />
        <select name="status" defaultValue={searchParams.status ?? ""} aria-label="Filter by status" className="rounded border border-mist bg-white px-3 py-2 text-sm">
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
        <button className="rounded bg-pine px-4 py-2 text-sm font-medium text-white">Apply filters</button>
      </form>

      <div className="overflow-x-auto rounded border border-mist bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-mist text-ink/70"><tr>
            {[["company", "Company"], ["title", "Job Title"], ["location", "Location"], ["score", "Match Score"]].map(([k, l]) => (<th key={k} className="px-3 py-2 font-medium"><a href={sortLink(k)}>{l}</a></th>))}
            <th className="px-3 py-2 font-medium">Recruiter Email</th>
            <th className="px-3 py-2 font-medium"><a href={sortLink("status")}>Status</a></th>
          </tr></thead>
          <tbody>
            {rows.length === 0 && (<tr><td colSpan={6} className="px-3 py-8 text-center text-ink/60">{all.length === 0 ? "No jobs yet. Job discovery is added in Stage 2." : "No jobs match these filters."}</td></tr>)}
            {rows.map((j) => (
              <tr key={j.id} className="border-b border-mist last:border-0">
                <td className="px-3 py-2">{j.companies?.name ?? "—"}</td>
                <td className="px-3 py-2">{j.title}</td>
                <td className="px-3 py-2">{j.location ?? "—"}</td>
                <td className="px-3 py-2 tabular-nums">{j.score ?? "—"}</td>
                <td className="px-3 py-2">{recruiterEmail(j) || "—"}</td>
                <td className="px-3 py-2"><span className={`rounded px-2 py-0.5 text-xs ${TONE[j.status] ?? "bg-mist"}`}>{STATUS_LABEL[j.status] ?? j.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
