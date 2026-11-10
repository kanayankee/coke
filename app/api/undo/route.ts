import { NextResponse } from "next/server";
import { loadAll, markDeleted } from "@/lib/sheets";
import { checkPassword, getStatus, invalidate } from "@/lib/service";
import { UNDO_WINDOW_MS } from "@/lib/status";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!(await checkPassword(body.password))) {
      return NextResponse.json({ error: "パスワードが違います" }, { status: 401 });
    }
    const { logs } = await loadAll();
    const latest = logs.filter((l) => !l.deleted).sort((a, b) => b.createdAt - a.createdAt)[0];
    if (!latest || Date.now() - latest.createdAt > UNDO_WINDOW_MS) {
      return NextResponse.json({ error: "取り消せる記録がありません(記録後10分以内のみ)" }, { status: 400 });
    }
    await markDeleted(latest.id);
    invalidate();
    return NextResponse.json(await getStatus(true));
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "取り消しに失敗しました" }, { status: 500 });
  }
}
