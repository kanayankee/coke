import { DAY, dayIndex, dayKey, dayStartMs, fmtJst, jstParts, parseDayKey, weekStartDay } from "./time";
import type { Log, PublicStatus, Settings, SizeDef, WeekResult, WeekRow } from "./types";

export const UNDO_WINDOW_MS = 10 * 60_000;
const DOW = ["月", "火", "水", "木", "金", "土", "日"];
const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100];

/** 開始週からの全週の上限・実績・クリア可否を、記録と設定から決定的に計算する */
export function computeWeeks(logs: Log[], s: Settings, rows: WeekRow[], nowMs: number): WeekResult[] {
  const startDay = parseDayKey(s.programStart);
  const wk = (d: number) => weekStartDay(d, startDay);
  const curWeek = wk(dayIndex(nowMs));
  const override = new Map(rows.filter((r) => r.limit != null).map((r) => [r.weekStart, r.limit as number]));
  const counts = new Map<number, number>();
  for (const l of logs) {
    if (l.deleted || l.type !== "drink") continue;
    const w = wk(dayIndex(l.at));
    counts.set(w, (counts.get(w) ?? 0) + 1);
  }
  const out: WeekResult[] = [];
  let prevLimit: number | null = null;
  let prevStage = 0;
  let prevCleared: boolean | null = null;
  let prevActual = 0;
  for (let wd = startDay; wd <= curWeek; wd += 7) {
    const key = dayKey(wd);
    const k = (wd - startDay) / 7;
    const actual = counts.get(wd) ?? 0;
    const completed = wd < curWeek;
    let limit: number | null = null;
    let stage = 0;
    if (k >= 1) {
      let computed: number;
      if (k === 1) {
        computed = Math.max(s.finalGoalPerWeek, prevActual - s.stepDown);
        stage = 1;
      } else if (prevCleared) {
        computed = Math.max(s.finalGoalPerWeek, (prevLimit as number) - s.stepDown);
        stage = prevStage + 1;
      } else {
        computed = prevLimit as number;
        stage = prevStage;
      }
      limit = override.get(key) ?? computed;
    }
    const cleared = completed && limit != null ? actual <= limit : null;
    out.push({ weekStart: key, stage, limit, actual: completed ? actual : counts.get(wd) ?? 0, cleared, completed });
    prevLimit = limit;
    prevStage = stage;
    prevCleared = cleared;
    prevActual = actual;
  }
  return out;
}

function isGraduated(weeks: WeekResult[], s: Settings) {
  let n = 0;
  for (let i = weeks.length - 1; i >= 0; i--) {
    const w = weeks[i];
    if (!w.completed) continue;
    if (w.limit != null && w.limit <= s.finalGoalPerWeek && w.cleared) n++;
    else break;
  }
  return n >= s.graduateWeeks;
}

export function buildStatus(logs: Log[], sizes: SizeDef[], s: Settings, rows: WeekRow[], nowMs: number): PublicStatus {
  const live = logs.filter((l) => !l.deleted);
  const drinks = live.filter((l) => l.type === "drink");
  const today = dayIndex(nowMs);
  const startDay = parseDayKey(s.programStart);
  const wk = (d: number) => weekStartDay(d, startDay);
  const curWeek = wk(today);
  const weeks = computeWeeks(logs, s, rows, nowMs);
  const cur = weeks.find((w) => w.weekStart === dayKey(curWeek));

  const weekDrinks = drinks.filter((l) => wk(dayIndex(l.at)) === curWeek);
  const count = weekDrinks.length;
  const daysLeft = curWeek + 7 - today;
  const limit = cur?.limit ?? null;
  const remaining = limit == null ? null : Math.max(0, limit - count);
  const allowanceToday = limit == null ? null : Math.max(0, Math.floor((limit - count) / daysLeft));

  const graduated = isGraduated(weeks, s);
  const state: PublicStatus["state"] = !cur ? "before" : graduated ? "graduated" : limit == null ? "measuring" : "active";

  const last = [...drinks].sort((a, b) => b.at - a.at)[0];
  const lastDay = last ? dayIndex(last.at) : null;
  const firstDay = Math.min(...[startDay, ...live.map((l) => dayIndex(l.at))]);
  const zeroStreak = Math.max(0, today - (lastDay ?? firstDay - 0));

  const latestWritten = [...live].sort((a, b) => b.createdAt - a.createdAt)[0];
  const undo =
    latestWritten && nowMs - latestWritten.createdAt <= UNDO_WINDOW_MS
      ? { until: latestWritten.createdAt + UNDO_WINDOW_MS, label: latestWritten.type === "skip" ? "我慢した記録" : `${latestWritten.size}` }
      : null;

  const perDay = new Map<number, number>();
  for (const l of drinks) perDay.set(dayIndex(l.at), (perDay.get(dayIndex(l.at)) ?? 0) + 1);
  const daily = Array.from({ length: 14 }, (_, i) => {
    const d = today - 13 + i;
    return { date: dayKey(d), count: perDay.get(d) ?? 0 };
  });

  // 直近14日の記録(新しい順)。容量はmlでなく本分で見せる
  const entries = live
    .filter((l) => dayIndex(l.at) >= today - 13)
    .sort((a, b) => b.at - a.at)
    .map((l) => {
      const p = jstParts(l.at);
      return {
        atMs: l.at,
        day: dayKey(dayIndex(l.at)),
        time: `${p.hour}:${String(p.minute).padStart(2, "0")}`,
        type: l.type,
        size: l.type === "skip" ? "我慢した" : l.size === "custom" ? `自由入力（${(l.volumeMl / 500).toFixed(1)}本分）` : l.size,
      };
    });

  const skipsPerDay = new Map<number, number>();
  for (const l of live) if (l.type === "skip") skipsPerDay.set(dayIndex(l.at), (skipsPerDay.get(dayIndex(l.at)) ?? 0) + 1);
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = curWeek + i;
    return {
      date: dayKey(d),
      label: DOW[(((d + 3) % 7) + 7) % 7],
      drinks: perDay.get(d) ?? 0,
      skips: skipsPerDay.get(d) ?? 0,
      isToday: d === today,
      isFuture: d > today,
    };
  });

  const price = new Map(sizes.map((z) => [z.label, z.priceYen]));
  const monthKey = dayKey(today).slice(0, 7);
  const monthDrinks = drinks.filter((l) => dayKey(dayIndex(l.at)).startsWith(monthKey));
  const sum = (ls: Log[], f: (l: Log) => number) => ls.reduce((a, l) => a + f(l), 0);
  const weekMl = sum(weekDrinks, (l) => l.volumeMl);
  const monthMl = sum(monthDrinks, (l) => l.volumeMl);

  const prevWeek = weeks.length >= 2 ? weeks[weeks.length - 2] : null;
  let story: PublicStatus["story"];
  if (prevWeek?.cleared && today - curWeek <= 1 && prevWeek.stage >= 1) {
    story = { template: "clear", headline: `ステージ${prevWeek.stage}クリア` };
  } else if (zeroStreak > 0 && STREAK_MILESTONES.includes(zeroStreak)) {
    story = { template: "streak", headline: `${zeroStreak}日連続でコーラなし` };
  } else if (remaining != null) {
    story = { template: "mid", headline: `今週あと${remaining}本` };
  } else {
    story = { template: "mid", headline: `今週は${count}本` };
  }

  return {
    nowMs,
    state,
    weekStart: dayKey(curWeek),
    weekEndMs: dayStartMs(curWeek + 7),
    stage: cur?.stage ?? 0,
    limit,
    count,
    remaining,
    daysLeft,
    allowanceToday,
    skipsThisWeek: live.filter((l) => l.type === "skip" && wk(dayIndex(l.at)) === curWeek).length,
    zeroStreak,
    lastDrink: last ? { atMs: last.at, label: fmtJst(last.at), size: last.size, volumeMl: last.volumeMl } : null,
    undo,
    daily,
    entries,
    weekDays,
    history: weeks.filter((w) => w.completed).reverse(),
    totals: {
      weekMl,
      monthMl,
      weekYen: sum(weekDrinks, (l) => price.get(l.size) ?? 0),
      monthYen: sum(monthDrinks, (l) => price.get(l.size) ?? 0),
      weekSugarG: Math.round((weekMl / 100) * s.sugarGPer100ml),
      monthSugarG: Math.round((monthMl / 100) * s.sugarGPer100ml),
      hasPrices: sizes.some((z) => z.priceYen > 0),
    },
    sizes,
    story,
    programStart: s.programStart,
  };
}
export { DAY };
