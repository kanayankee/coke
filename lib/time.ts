// すべて日本時間(JST, UTC+9)。1日・1週は朝4時区切り、週は月曜始まり。
// 「UTC+9-4h = UTC+5h」だけずらした時刻で暦計算すれば、区切りはUTCの0時になる。
export const H = 3_600_000;
export const DAY = 24 * H;
const SHIFT = 5 * H;

/** 論理日の通し番号(1970-01-01 = 0)。朝4時に切り替わる */
export const dayIndex = (ms: number) => Math.floor((ms + SHIFT) / DAY);
export const dayKey = (d: number) => new Date(d * DAY).toISOString().slice(0, 10);
export const parseDayKey = (s: string) => Math.floor(Date.parse(`${s}T00:00:00Z`) / DAY);
export const dayStartMs = (d: number) => d * DAY - SHIFT;
/**
 * その論理日を含む週の初日(論理日の通し番号)。1970-01-01は木曜。
 * anchor を渡すと、その日と同じ曜日を週の初日にする(プログラム開始日の曜日)。省略時は月曜。
 */
export const weekStartDay = (d: number, anchor?: number) => {
  const a = anchor ?? d - (((d + 3) % 7) + 7) % 7;
  return d - (((d - a) % 7) + 7) % 7;
};

/** 2026-11-10T21:30:00+09:00 形式 */
export const toJstIso = (ms: number) =>
  new Date(ms + 9 * H).toISOString().slice(0, 19) + "+09:00";

export function jstParts(ms: number) {
  const d = new Date(ms + 9 * H);
  return { month: d.getUTCMonth() + 1, day: d.getUTCDate(), hour: d.getUTCHours(), minute: d.getUTCMinutes() };
}

export function fmtJst(ms: number) {
  const p = jstParts(ms);
  return `${p.month}月${p.day}日 ${p.hour}時${String(p.minute).padStart(2, "0")}分`;
}

export function fmtAgo(fromMs: number, nowMs: number) {
  const diff = Math.max(0, nowMs - fromMs);
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "たった今";
  if (min < 60) return `${min}分前`;
  const h = Math.floor(min / 60);
  if (h < 48) return `${h}時間前`;
  return `${Math.floor(h / 24)}日前`;
}
