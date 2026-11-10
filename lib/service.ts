import { timingSafeEqual } from "node:crypto";
import { loadAll, syncWeeks } from "./sheets";
import { buildStatus, computeWeeks } from "./status";
import type { PublicStatus } from "./types";

let cache: { at: number; value: PublicStatus } | null = null;
const TTL = 60_000;
export const invalidate = () => {
  cache = null;
};

/** 週の締め(M-6): 判定済みでない週を weeks シートに書き込む。失敗しても表示は止めない */
async function closeWeeks(data: Awaited<ReturnType<typeof loadAll>>, nowMs: number) {
  try {
    const computed = computeWeeks(data.logs, data.settings, data.weeks, nowMs).map((w) => ({
      weekStart: w.weekStart,
      stage: w.stage,
      limit: w.limit,
      actual: w.completed ? w.actual : null,
      cleared: w.cleared,
    }));
    await syncWeeks(computed, data.weeks);
  } catch (e) {
    console.error("weeks sync failed", e instanceof Error ? e.message : e);
  }
}

export async function getStatus(fresh = false): Promise<PublicStatus> {
  const now = Date.now();
  if (!fresh && cache && now - cache.at < TTL) return { ...cache.value, nowMs: now };
  const data = await loadAll();
  await closeWeeks(data, now);
  const value = buildStatus(data.logs, data.sizes, data.settings, data.weeks, now);
  cache = { at: now, value };
  return value;
}

export async function checkPassword(input: unknown): Promise<boolean> {
  const { settings } = await loadAll();
  const a = Buffer.from(String(input ?? ""));
  const b = Buffer.from(settings.recordPassword);
  const ok = settings.recordPassword !== "" && a.length === b.length && timingSafeEqual(a, b);
  if (!ok) await new Promise((r) => setTimeout(r, 800));
  return ok;
}
