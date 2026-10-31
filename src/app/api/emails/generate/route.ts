import { NextResponse } from "next/server";
import { isOwner } from "@/lib/auth";
import { generateEmails } from "@/lib/emails";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST() {
  if (!(await isOwner())) return NextResponse.json({ error: "Unauthorized. Sign in again with the owner account." }, { status: 401 });
  try { return NextResponse.json(await generateEmails()); }
  catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 500 }); }
}
