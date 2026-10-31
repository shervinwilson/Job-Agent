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
    // Same rule the database uses: the signed-in email must be in app_owner
    const { data } = await supabaseServer().rpc("is_owner");
    ownerOk = data === true;
  }
  if (!cronOk && !ownerOk) return NextResponse.json({ error: "Unauthorized. Sign in again with the owner account." }, { status: 401 });
  try { return NextResponse.json(await runDiscovery()); }
  catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 500 }); }
}
export const GET = handle, POST = handle;