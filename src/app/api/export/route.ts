import { applyFilters, loadJobs, recruiterEmail, STATUS_LABEL } from "@/lib/jobs";

const esc = (v: string | number | null) => `"${String(v ?? "").replace(/"/g, '""')}"`;

export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const rows = applyFilters(await loadJobs(), p.get("q") ?? undefined, p.get("status") ?? undefined, p.get("sort") ?? undefined, p.get("dir") ?? undefined);
  const csv = [["Company","Job Title","Location","Match Score","Recruiter Email","Status"].join(","),
    ...rows.map((j) => [j.companies?.name ?? "", j.title, j.location, j.score, recruiterEmail(j), STATUS_LABEL[j.status] ?? j.status].map(esc).join(","))].join("\n");
  return new Response(csv, { headers: { "Content-Type": "text/csv", "Content-Disposition": 'attachment; filename="jobs.csv"' } });
}
