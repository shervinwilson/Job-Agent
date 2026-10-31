import { NextResponse } from "next/server";
import { isOwner } from "@/lib/auth";
import { discardEmail } from "@/lib/emails";

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  if (!(await isOwner())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { await discardEmail(params.id); return NextResponse.json({ ok: true }); }
  catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }); }
}
