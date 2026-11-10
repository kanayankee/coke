import { NextResponse } from "next/server";
import { appendLog, loadAll } from "@/lib/sheets";
import { checkPassword, getStatus, invalidate } from "@/lib/service";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!(await checkPassword(body.password))) {
      return NextResponse.json({ error: "パスワードが違います" }, { status: 401 });
    }
    const kind = body.kind === "skip" ? "skip" : "drink";
    const now = Date.now();
    let at = now;
    if (body.at != null) {
      at = Number(body.at);
      if (!Number.isFinite(at) || at > now + 5 * 60_000) {
        return NextResponse.json({ error: "日時が正しくありません" }, { status: 400 });
      }
    }
    let size = "";
    let volumeMl = 0;
    if (kind === "drink") {
      if (body.sizeLabel) {
        const def = (await loadAll()).sizes.find((z) => z.label === body.sizeLabel);
        if (!def) return NextResponse.json({ error: "サイズが見つかりません" }, { status: 400 });
        size = def.label;
        volumeMl = def.volumeMl;
      } else {
        volumeMl = Math.round(Number(body.volumeMl));
        if (!Number.isFinite(volumeMl) || volumeMl <= 0 || volumeMl > 5000) {
          return NextResponse.json({ error: "mlは1〜5000で入力してください" }, { status: 400 });
        }
        size = "custom";
      }
    } else {
      size = "skip";
    }
    await appendLog({ at, type: kind, size, volumeMl });
    invalidate();
    return NextResponse.json(await getStatus(true));
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "記録に失敗しました" }, { status: 500 });
  }
}
