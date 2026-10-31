import { NextResponse } from "next/server";
import { runDiscovery } from "@/lib/discovery";
import { supabaseServer } from "@/lib/supabase/server";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

async function handle(req: Request) {
  const bearer = req.headers.get("authorization");
  const cronOk = !!process.env.CRON_SECRET && bearer === `Bearer ${process.env.CRON_SECRET}`;
  let ownerOk = false;
  if (!cronOk) {
    const { data: { user } } = await supabaseServer().auth.getUser();
    ownerOk = !!user?.email && user.email.toLowerCase() === process.env.ALLOWED_EMAIL?.toLowerCase();
  }
  if (!cronOk && !ownerOk) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { return NextResponse.json(await runDiscovery()); }
  catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 500 }); }
}
export const GET = handle, POST = handle;
