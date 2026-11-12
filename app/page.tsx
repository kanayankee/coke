"use client";
import { useCallback, useEffect, useState } from "react";
import type { PublicStatus } from "@/lib/types";

const PW_KEY = "cola-log-pw";
type Mode = null | "drink" | "skip" | "late" | "undo";

function ago(fromMs: number, now: number) {
  const min = Math.max(0, Math.floor((now - fromMs) / 60000));
  if (min < 1) return "たった今";
  if (min < 60) return `${min}分前`;
  const h = Math.floor(min / 60);
  return h < 48 ? `${h}時間前` : `${Math.floor(h / 24)}日前`;
}
const yen = (n: number) => `¥${n.toLocaleString("ja-JP")}`;
// 容量は500mlペット換算の「本分」で表示する
const eq = (ml: number) => `${(ml / 500).toFixed(1)}本分`;

function barColor(count: number, limit: number | null) {
  if (limit == null) return "var(--green)";
  if (limit === 0) return count > 0 ? "var(--red)" : "var(--green)";
  const r = count / limit;
  return r >= 1 ? "var(--red)" : r >= 0.7 ? "var(--yellow)" : "var(--green)";
}

export default function Home() {
  const [st, setSt] = useState<PublicStatus | null>(null);
  const [err, setErr] = useState("");
  const [now, setNow] = useState(Date.now());
  const [mode, setMode] = useState<Mode>(null);
  const [pw, setPw] = useState<string | null>(null); // ログイン済みならパスワード(メモリ上)
  const [login, setLogin] = useState(false);
  const [selDay, setSelDay] = useState<string | null>(null);

  useEffect(() => { try { const v = localStorage.getItem(PW_KEY); if (v) setPw(v); } catch {} }, []);
  const lock = useCallback(() => { try { localStorage.removeItem(PW_KEY); } catch {} setPw(null); }, []);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/status", { cache: "no-store" });
      if (!r.ok) throw new Error();
      setSt(await r.json());
      setErr("");
    } catch {
      setErr("読み込めませんでした。電波の良いところでもう一度。");
    }
  }, []);

  useEffect(() => {
    load();
    const a = setInterval(load, 3 * 60_000); // M-13 自動更新
    const b = setInterval(() => setNow(Date.now()), 30_000);
    return () => { clearInterval(a); clearInterval(b); };
  }, [load]);

  if (!st) return <div className="wrap"><h1><img src="/logo.png" alt="COKELOG" className="logo" /></h1><p>{err || "読み込み中…"}</p></div>;

  const today = st.daily[13];
  const yest = st.daily[12];
  const d = today.count - yest.count;
  const diffText = d < 0 ? `昨日より${-d}本少ない` : d === 0 ? "昨日と同じペース" : `昨日より${d}本多め（今日はまだ途中）`;
  const dayLabel = (day: string) => (day === today.date ? "今日" : day === yest.date ? "昨日" : day.slice(5).replace("-", "/"));
  const max = Math.max(3, ...st.daily.map((d) => d.count));
  const pct = st.limit == null ? 0 : st.limit === 0 ? (st.count > 0 ? 100 : 0) : Math.min(100, (st.count / st.limit) * 100);
  const undoable = st.undo && st.undo.until > now;

  let headline = "";
  if (st.state === "before") headline = `開始は ${st.programStart}`;
  else if (st.state === "graduated") headline = "卒業おめでとう 🎉";
  else if (st.limit == null) headline = "計測週：ふだんの本数を測ろう";
  else if (st.remaining === 0) headline = st.count > st.limit ? "今週は上限を超えました" : "今週はここまで";
  else headline = `今週あと ${st.remaining} 本`;

  return (
    <div className="wrap">
      <h1><img src="/logo.png" alt="COKELOG" className="logo" /> <small>{st.state === "active" || st.state === "graduated" ? `ステージ ${st.stage}` : st.state === "measuring" ? "計測週" : ""}</small></h1>
      {err && <p className="err">{err}</p>}

      <section className="card hero">
        <p className="big">{headline}</p>
        <div className="nums"><b>{st.count}</b> 本{st.limit != null && <> ／ 上限 <b>{st.limit}</b> 本</>}</div>
        {st.limit != null && <div className="bar"><i style={{ width: `${pct}%`, background: barColor(st.count, st.limit) }} /></div>}
        <div className="chips">
          {st.allowanceToday != null && <span className="chip">今日の目安：あと {st.allowanceToday} 本まで</span>}
          <span className="chip">今週の我慢 {st.skipsThisWeek} 回</span>
        </div>
      </section>

      <section className="card">
        <h2>今日と昨日</h2>
        <div className="tyrow">
          <div><span className="lbl">今日</span><span className="stat">{today.count}<small>本</small></span></div>
          <div><span className="lbl">昨日</span><span className="stat">{yest.count}<small>本</small></span></div>
        </div>
        <p className="diff">{diffText}</p>
      </section>

      <section className="card last">
        <h2>最後に飲んだ日時</h2>
        {st.lastDrink ? (
          <>
            <div className="when">{st.lastDrink.label}</div>
            <div className="ago">（{ago(st.lastDrink.atMs, now)}）</div>
            <div className="sz">{st.lastDrink.size === "custom" ? `自由入力（${eq(st.lastDrink.volumeMl)}）` : st.lastDrink.size}</div>
          </>
        ) : <div className="when">まだ記録がありません</div>}
      </section>

      <div className="row2" style={{ marginBottom: 12 }}>
        <section className="card"><h2>連続ゼロ日数</h2><div className="stat">{st.zeroStreak}<small>日</small></div></section>
        <section className="card"><h2>今週の合計（500mlペット換算）</h2><div className="stat">{(st.totals.weekMl / 500).toFixed(1)}<small>本分</small></div></section>
      </div>

      <section className="card">
        <h2>今週の日別</h2>
        <div className="week">
          {st.weekDays.map((d) => (
            <div key={d.date} className={`day ${d.isToday ? "today" : ""} ${d.isFuture ? "future" : d.drinks === 0 ? "zero" : "some"}`}>
              <span className="dow">{d.label}</span>
              <b>{d.isFuture ? "–" : d.drinks}</b>
              <i>{!d.isFuture && d.skips > 0 ? `我慢${d.skips}` : "\u00a0"}</i>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>直近14日の本数</h2>
        <div className="graph">
          {st.daily.map((d) => (
            <div key={d.date} role="button" className={selDay === d.date ? "sel" : ""} onClick={() => setSelDay(selDay === d.date ? null : d.date)}>{d.count > 0 && d.count}<i className={d.count === 0 ? "zero" : ""} style={{ height: `${(d.count / max) * 70}%` }} /></div>
          ))}
        </div>
        <div className="axis"><span>{st.daily[0].date.slice(5).replace("-", "/")}</span><span>{st.daily[13].date.slice(5).replace("-", "/")}</span></div>
        {selDay ? (
          <div className="detail">
            <b>{dayLabel(selDay)}</b>
            {st.entries.filter((e) => e.day === selDay).length === 0 ? <p>記録なし</p> : st.entries.filter((e) => e.day === selDay).map((e) => <EntryRow key={e.atMs} e={e} />)}
          </div>
        ) : <p className="note">棒をタップすると、その日の中身が見られます</p>}
      </section>

      <section className="card">
        <h2>最近の記録</h2>
        {st.entries.length === 0 ? <p className="note">まだ記録がありません</p> : st.entries.slice(0, 10).map((e) => (
          <div key={e.atMs} className="rec"><span className="rd">{dayLabel(e.day)}</span><EntryRow e={e} /></div>
        ))}
      </section>

      <section className="card">
        <h2>換算（今週 / 今月）</h2>
        <table><tbody>
          <tr><td>合計(500ml換算)</td><td>{eq(st.totals.weekMl)}</td><td>{eq(st.totals.monthMl)}</td></tr>
          {st.totals.hasPrices && <tr><td>金額</td><td>{yen(st.totals.weekYen)}</td><td>{yen(st.totals.monthYen)}</td></tr>}
          <tr><td>糖分</td><td>{st.totals.weekSugarG}g</td><td>{st.totals.monthSugarG}g</td></tr>
        </tbody></table>
      </section>

      {st.history.length > 0 && (
        <section className="card">
          <h2>ステージ履歴</h2>
          <table>
            <thead><tr><th>週</th><th>上限</th><th>実績</th><th>結果</th></tr></thead>
            <tbody>
              {st.history.map((w) => (
                <tr key={w.weekStart}>
                  <td>{w.weekStart.slice(5).replace("-", "/")}〜</td>
                  <td>{w.limit ?? "計測"}</td>
                  <td>{w.actual}本</td>
                  <td>{w.cleared == null ? "—" : w.cleared ? <span className="ok">クリア</span> : <span className="ng">再挑戦</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <div className="links">
        {pw && <StoryButton />}
        {pw && <button className="btn line" onClick={() => setMode("late")}>後から記録</button>}
        {pw && undoable && <button className="btn line" onClick={() => setMode("undo")}>直前の記録を取り消す</button>}
        {pw && <button className="btn line" onClick={lock}>ログアウト</button>}
      </div>

      {pw ? (
        <div className="dock"><div className="in">
          <button className="btn red" onClick={() => setMode("drink")}>飲んだ</button>
          <button className="btn green" onClick={() => setMode("skip")}>我慢した</button>
        </div></div>
      ) : (
        <button className="fab" aria-label="記録する(ログイン)" onClick={() => setLogin(true)}>✏️</button>
      )}

      {login && <LoginDialog onClose={() => setLogin(false)} onOk={(p) => { setPw(p); setLogin(false); }} />}
      {mode && pw && <RecordDialog mode={mode} st={st} pw={pw} onUnauthorized={lock} onClose={() => setMode(null)} onDone={(s) => { setSt(s); setMode(null); }} />}
    </div>
  );
}

function EntryRow({ e }: { e: PublicStatus["entries"][number] }) {
  return <span className={`entry ${e.type}`}><time>{e.time}</time> {e.size}</span>;
}

function StoryButton() {
  const [busy, setBusy] = useState(false);
  async function share() {
    setBusy(true);
    try {
      const r = await fetch("/api/story", { cache: "no-store" });
      const blob = await r.blob();
      const file = new File([blob], "cola-log-story.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] });
      } else {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = file.name;
        a.click();
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") alert("画像を作れませんでした");
    } finally { setBusy(false); }
  }
  return <button className="btn line" disabled={busy} onClick={share}>{busy ? "作成中…" : "ストーリー用に共有"}</button>;
}

function LoginDialog({ onClose, onOk }: { onClose: () => void; onOk: (pw: string) => void }) {
  const [pw, setPw] = useState("");
  const [remember, setRemember] = useState(true);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit() {
    if (!pw) return setMsg("パスワードを入力してください");
    setBusy(true);
    setMsg("");
    try {
      const r = await fetch("/api/verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: pw }) });
      if (!r.ok) throw new Error((await r.json()).error || "失敗しました");
      if (remember) { try { localStorage.setItem(PW_KEY, pw); } catch {} }
      onOk(pw);
    } catch (e) { setMsg((e as Error).message); setBusy(false); }
  }
  return (
    <div className="sheet-bg" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h3>ログイン</h3>
        <input type="password" value={pw} autoFocus onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} autoComplete="current-password" placeholder="パスワード" />
        <label className="chk"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />この端末で記憶する</label>
        {msg && <div className="err">{msg}</div>}
        <button className="btn red full" disabled={busy} onClick={submit}>{busy ? "確認中…" : "ログイン"}</button>
        <button className="btn line full" style={{ marginTop: 8 }} onClick={onClose}>やめる</button>
      </div>
    </div>
  );
}

function RecordDialog({ mode, st, pw, onUnauthorized, onClose, onDone }: { mode: Exclude<Mode, null>; st: PublicStatus; pw: string; onUnauthorized: () => void; onClose: () => void; onDone: (s: PublicStatus) => void }) {
  const [label, setLabel] = useState("");
  const [custom, setCustom] = useState(false);
  const [ml, setMl] = useState("");
  const [at, setAt] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const needSize = mode === "drink" || mode === "late";

  async function submit() {
    setMsg("");
    if (needSize && !custom && !label) return setMsg("サイズを選んでください");
    if (needSize && custom && !(Number(ml) > 0)) return setMsg("mlを入力してください");
    if (mode === "late" && !at) return setMsg("日時を選んでください");
    setBusy(true);
    const body = mode === "undo" ? { password: pw } : {
      password: pw,
      kind: mode === "skip" ? "skip" : "drink",
      ...(needSize ? (custom ? { volumeMl: Number(ml) } : { sizeLabel: label }) : {}),
      ...(mode === "late" ? { at: new Date(at + ":00+09:00").getTime() } : {}),
    };
    try {
      const r = await fetch(mode === "undo" ? "/api/undo" : "/api/log", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok) {
        if (r.status === 401) onUnauthorized();
        throw new Error(j.error || "失敗しました");
      }
      onDone(j);
    } catch (e) { setMsg((e as Error).message); setBusy(false); }
  }

  const groups = [...new Set(st.sizes.map((z) => z.group))];
  const title = { drink: "飲んだ", skip: "我慢した", late: "後から記録", undo: "直前の記録を取り消す" }[mode];
  return (
    <div className="sheet-bg" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        {mode === "undo" && <p>「{st.undo?.label}」を取り消します。</p>}
        {mode === "late" && (<><div className="grp">いつ飲みましたか</div><input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} /></>)}
        {needSize && (
          <>
            {groups.map((g) => (
              <div key={g}>
                <div className="grp">{g}</div>
                <div className="sizes">
                  {st.sizes.filter((z) => z.group === g).map((z) => (
                    <button key={z.label} className={`size ${!custom && label === z.label ? "sel" : ""}`} onClick={() => { setLabel(z.label); setCustom(false); }}>{z.label}</button>
                  ))}
                </div>
              </div>
            ))}
            <div className="grp">自由入力</div>
            <div className="sizes">
              <button className={`size ${custom ? "sel" : ""}`} onClick={() => setCustom(true)}>その他</button>
              {custom && <input type="number" inputMode="numeric" placeholder="ml" value={ml} onChange={(e) => setMl(e.target.value)} style={{ marginTop: 0 }} />}
            </div>
          </>
        )}
        {msg && <div className="err">{msg}</div>}
        <button className={`btn full ${mode === "skip" ? "green" : "red"}`} style={{ marginTop: 12 }} disabled={busy} onClick={submit}>{busy ? "送信中…" : mode === "undo" ? "取り消す" : "記録する"}</button>
        <button className="btn line full" style={{ marginTop: 8 }} onClick={onClose}>やめる</button>
      </div>
    </div>
  );
}
