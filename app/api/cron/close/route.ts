import { NextResponse } from "next/server";
import { getStatus } from "@/lib/service";

export const dynamic = "force-dynamic";

// 月曜朝4時(JST)に前週を判定して weeks シートへ書き込む。Vercel Cron から呼ばれる
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const st = await getStatus(true);
  return NextResponse.json({ ok: true, weekStart: st.weekStart, stage: st.stage, limit: st.limit });
}
