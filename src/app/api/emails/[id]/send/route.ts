import { NextResponse } from "next/server";
import { isOwner } from "@/lib/auth";
import { sendEmail } from "@/lib/emails";

export const maxDuration = 30;

export async function POST(req: Request, { params }: { params: { id: string } }) {
  if (!(await isOwner())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { subject, body } = await req.json();
    await sendEmail(params.id, String(subject ?? ""), String(body ?? ""));
    return NextResponse.json({ ok: true });
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }); }
}
