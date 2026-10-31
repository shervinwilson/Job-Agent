import { NextResponse } from "next/server";
import { runContactDiscovery } from "@/lib/contacts";
import { supabaseServer } from "@/lib/supabase/server";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST() {
  const { data } = await supabaseServer().rpc("is_owner");
  if (data !== true) return NextResponse.json({ error: "Unauthorized. Sign in again with the owner account." }, { status: 401 });
  try { return NextResponse.json(await runContactDiscovery()); }
  catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 500 }); }
}
