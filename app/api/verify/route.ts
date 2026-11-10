import { NextResponse } from "next/server";
import { checkPassword } from "@/lib/service";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  if (!(await checkPassword(body.password))) {
    return NextResponse.json({ error: "パスワードが違います" }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}
