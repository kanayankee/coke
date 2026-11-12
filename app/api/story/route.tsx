import { ImageResponse } from "next/og";
import { getStatus } from "@/lib/service";
import { fmtAgo, fmtDay } from "@/lib/time";

export const dynamic = "force-dynamic";

async function loadFont(text: string): Promise<ArrayBuffer | null> {
  try {
    const css = await (
      await fetch(`https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@800&text=${encodeURIComponent(text)}`, {
        headers: { "User-Agent": "Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10_6_8; de-at) AppleWebKit/533.21.1 (KHTML, like Gecko) Version/5.0.5 Safari/533.21.1" },
      })
    ).text();
    const m = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/);
    return m ? await (await fetch(m[1])).arrayBuffer() : null;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const st = await getStatus();
  const t = new URL(req.url).searchParams.get("t");
  const headline = t === "mid" ? (st.remaining != null ? `今週あと${st.remaining}本` : `今週は${st.count}本`) : st.story.headline;
  const color = st.story.template === "mid" ? "#d62828" : "#2e9e5b";
  const d = new Date(st.nowMs + 9 * 3600_000);
  const dateText = fmtDay(d.toISOString().slice(0, 10));
  const count = `${st.count}`;
  const limit = st.limit != null ? `${st.limit}` : "";
  const pct = st.limit == null ? 0 : st.limit === 0 ? (st.count > 0 ? 100 : 0) : Math.min(100, (st.count / st.limit) * 100);
  const barColor = st.limit == null || pct < 70 ? "#2e9e5b" : pct < 100 ? "#f4b400" : "#d62828";
  const stageText = st.state === "measuring" ? "計測週" : st.state === "before" ? "準備中" : `ステージ ${st.stage}`;
  const streakText = `連続ゼロ ${st.zeroStreak}日`;
  const lastText = st.lastDrink ? `${st.lastDrink.label}（${fmtAgo(st.lastDrink.atMs, st.nowMs)}）` : "記録なし";
  const max = Math.max(3, ...st.daily.map((x) => x.count));

  const fontText = "コーラログ今週あと本は上限ステージ計測週準備中連続ゼロ日最後に飲んだ記録なしクリア直近の推移分前時間たった今月年0123456789.:/（）／()月火水木金土日 " + headline + lastText + stageText;
  const font = await loadFont(fontText);
  let logo: string | null = null;
  try {
    const buf = await (await fetch(new URL("/logo.png", req.url))).arrayBuffer();
    logo = `data:image/png;base64,${Buffer.from(buf).toString("base64")}`;
  } catch {}

  const row = { display: "flex" } as const;
  return new ImageResponse(
    (
      <div style={{ width: 1080, height: 1920, display: "flex", flexDirection: "column", background: "#ffffff", padding: "150px 80px 0", fontFamily: "NotoSansJP, sans-serif", color: "#1c1c1e" }}>
        <div style={{ ...row, justifyContent: "space-between", fontSize: 36, color: "#6b6b70" }}>
          <div style={row}>{logo ? <img src={logo} width={300} height={80} alt="" /> : "COKELOG"}</div>
          <div style={row}>{dateText}</div>
        </div>
        <div style={{ ...row, fontSize: 124, marginTop: 70, color }}>{headline}</div>
        <div style={{ ...row, alignItems: "flex-end", marginTop: 40 }}>
          <div style={{ ...row, fontSize: 200, lineHeight: 1 }}>{count}</div>
          {st.limit != null && <div style={{ ...row, fontSize: 64, color: "#6b6b70", marginLeft: 24, marginBottom: 18 }}>{`／ 上限 ${limit} 本`}</div>}
          {st.limit == null && <div style={{ ...row, fontSize: 64, color: "#6b6b70", marginLeft: 24, marginBottom: 18 }}>本</div>}
        </div>
        {st.limit != null && (
          <div style={{ ...row, height: 36, borderRadius: 18, background: "#e3e3e8", marginTop: 30, overflow: "hidden" }}>
            <div style={{ ...row, width: `${pct}%`, height: 36, background: barColor, borderRadius: 18 }} />
          </div>
        )}
        <div style={{ ...row, marginTop: 50 }}>
          <div style={{ ...row, background: "#f6f6f8", borderRadius: 999, padding: "16px 36px", fontSize: 40 }}>{stageText}</div>
          <div style={{ ...row, background: "#f6f6f8", borderRadius: 999, padding: "16px 36px", fontSize: 40, marginLeft: 20 }}>{streakText}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", marginTop: 60, background: "#f6f6f8", borderRadius: 36, padding: "36px 44px" }}>
          <div style={{ ...row, fontSize: 32, color: "#6b6b70" }}>最後に飲んだ</div>
          <div style={{ ...row, fontSize: 48, marginTop: 8 }}>{lastText}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", marginTop: 40 }}>
          <div style={{ ...row, fontSize: 32, color: "#6b6b70" }}>直近14日</div>
          <div style={{ ...row, alignItems: "flex-end", height: 180, marginTop: 16 }}>
            {st.daily.map((x) => (
              <div key={x.date} style={{ ...row, flex: 1, margin: "0 3px", height: Math.max(6, (x.count / max) * 180), background: x.count ? "#d62828" : "#d9d9de", borderRadius: "6px 6px 0 0" }} />
            ))}
          </div>
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1920,
      fonts: font ? [{ name: "NotoSansJP", data: font, weight: 800, style: "normal" }] : undefined,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
