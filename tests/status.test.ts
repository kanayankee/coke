import { describe, expect, it } from "vitest";
import { buildStatus, computeWeeks } from "@/lib/status";
import type { Log, Settings } from "@/lib/types";

const S: Settings = { recordPassword: "x", programStart: "2026-11-16", finalGoalPerWeek: 2, stepDown: 1, sugarGPer100ml: 11, graduateWeeks: 2 };
const t = (s: string) => Date.parse(s);
let n = 0;
const drink = (at: string): Log => ({ id: String(n++), at: t(at), type: "drink", size: "ペット 500", volumeMl: 500, createdAt: t(at), deleted: false });

describe("ステージ進行", () => {
  // 計測週(11/16週)に5本 → 11/23週の上限は4
  const logs = [
    ...["16", "17", "18", "19", "20"].map((d) => drink(`2026-11-${d}T12:00:00+09:00`)),
    ...["24", "25", "26"].map((d) => drink(`2026-11-${d}T12:00:00+09:00`)), // 3本 ≤ 4 → クリア
  ];
  it("計測週は上限なし", () => {
    const w = computeWeeks(logs, S, [], t("2026-11-18T12:00:00+09:00"));
    expect(w).toHaveLength(1);
    expect(w[0].limit).toBeNull();
  });
  it("最初の上限=計測週-step", () => {
    const w = computeWeeks(logs, S, [], t("2026-11-24T12:00:00+09:00"));
    expect(w[1]).toMatchObject({ stage: 1, limit: 4 });
  });
  it("クリアで次の週は上限が1下がる", () => {
    const w = computeWeeks(logs, S, [], t("2026-11-30T12:00:00+09:00"));
    expect(w[1]).toMatchObject({ cleared: true, actual: 3 });
    expect(w[2]).toMatchObject({ stage: 2, limit: 3 });
  });
  it("未達成なら同じ上限で再挑戦", () => {
    const over = [...logs, ...["27", "28"].map((d) => drink(`2026-11-${d}T12:00:00+09:00`))]; // 5本 > 4
    const w = computeWeeks(over, S, [], t("2026-11-30T12:00:00+09:00"));
    expect(w[1].cleared).toBe(false);
    expect(w[2]).toMatchObject({ stage: 1, limit: 4 });
  });
  it("月曜3時59分の記録は前の週に数える", () => {
    const l = [...logs, drink("2026-11-30T03:59:00+09:00")]; // 11/23週の4本目
    const w = computeWeeks(l, S, [], t("2026-11-30T12:00:00+09:00"));
    expect(w[1].actual).toBe(4);
  });
  it("上限は下限(最終目標)より下がらない", () => {
    const s = { ...S, finalGoalPerWeek: 4 };
    const w = computeWeeks(logs, s, [], t("2026-11-30T12:00:00+09:00"));
    expect(w[2].limit).toBe(4);
  });
  it("weeksシートの手書き上限が優先される", () => {
    const w = computeWeeks(logs, S, [{ weekStart: "2026-11-23", stage: 1, limit: 6, actual: null, cleared: null }], t("2026-11-24T12:00:00+09:00"));
    expect(w[1].limit).toBe(6);
  });
});

describe("今日の目安", () => {
  const logs = ["16", "17", "18", "19", "20"].map((d) => drink(`2026-11-${d}T12:00:00+09:00`)).concat(drink("2026-11-24T12:00:00+09:00"));
  it("(上限-今週本数)/残り日数 の切り捨て", () => {
    // 11/24(火)正午: 上限4、今週1本、残り6日(火〜日) → floor(3/6)=0
    const st = buildStatus(logs, [], S, [], t("2026-11-24T12:00:00+09:00"));
    expect(st.limit).toBe(4);
    expect(st.count).toBe(1);
    expect(st.daysLeft).toBe(6);
    expect(st.allowanceToday).toBe(0);
    expect(st.remaining).toBe(3);
  });
  it("深夜3時は前日扱いで残り日数が増える", () => {
    const st = buildStatus(logs, [], S, [], t("2026-11-25T03:00:00+09:00")); // 論理日は火曜
    expect(st.daysLeft).toBe(6);
  });
  it("連続ゼロ日数", () => {
    const st = buildStatus(logs, [], S, [], t("2026-11-27T12:00:00+09:00"));
    expect(st.zeroStreak).toBe(3);
  });
});

describe("木曜開始のプログラム", () => {
  const S2: Settings = { ...S, programStart: "2026-11-05" };
  it("週は開始日と同じ木曜区切り(木曜3時59分は前の週)", () => {
    const logs = [drink("2026-11-06T12:00:00+09:00"), drink("2026-11-12T03:59:00+09:00"), drink("2026-11-12T04:00:00+09:00")];
    const w = computeWeeks(logs, S2, [], t("2026-11-13T12:00:00+09:00"));
    expect(w.map((x) => x.weekStart)).toEqual(["2026-11-05", "2026-11-12"]);
    expect(w[0].actual).toBe(2);
    expect(w[1].limit).toBe(2); // 計測週2本-1=1 だが最終目標2を下回らない
  });
  it("開始週の途中は計測週として表示される", () => {
    const st = buildStatus([drink("2026-11-06T12:00:00+09:00")], [], S2, [], t("2026-11-10T12:00:00+09:00"));
    expect(st.state).toBe("measuring");
    expect(st.weekStart).toBe("2026-11-05");
    expect(st.daysLeft).toBe(2); // 火・水(木曜4時から次の週)
  });
});
