import { describe, expect, it } from "vitest";
import { dayIndex, dayKey, weekStartDay, toJstIso, fmtJst, fmtDay } from "@/lib/time";

const t = (s: string) => Date.parse(s);
const logical = (s: string) => dayKey(dayIndex(t(s)));
const weekOf = (s: string) => dayKey(weekStartDay(dayIndex(t(s))));

describe("1日は朝4時区切り", () => {
  it("11/10 深夜2時は 11/9 に数える", () => expect(logical("2026-11-10T02:00:00+09:00")).toBe("2026-11-09"));
  it("深夜3時59分は前の日", () => expect(logical("2026-11-10T03:59:00+09:00")).toBe("2026-11-09"));
  it("朝4時ちょうどから次の日", () => expect(logical("2026-11-10T04:00:00+09:00")).toBe("2026-11-10"));
  it("UTCで日付が違うサーバでも同じ(UTC 18:30 = JST 3:30)", () =>
    expect(logical("2026-11-09T18:30:00Z")).toBe("2026-11-09"));
});

describe("週は月曜朝4時区切り", () => {
  it("月曜3時59分は前の週(11/2始まり)", () => expect(weekOf("2026-11-09T03:59:00+09:00")).toBe("2026-11-02"));
  it("月曜4時ちょうどから新しい週", () => expect(weekOf("2026-11-09T04:00:00+09:00")).toBe("2026-11-09"));
  it("日曜は同じ週", () => expect(weekOf("2026-11-15T23:00:00+09:00")).toBe("2026-11-09"));
  it("週の途中", () => expect(weekOf("2026-11-12T12:00:00+09:00")).toBe("2026-11-09"));
});

describe("整形", () => {
  it("toJstIso", () => expect(toJstIso(t("2026-11-10T12:30:00Z"))).toBe("2026-11-10T21:30:00+09:00"));
  it("fmtDay", () => expect(fmtDay("2026-11-09")).toBe("11月9日(月)"));
  it("fmtJst", () => expect(fmtJst(t("2026-11-10T21:05:00+09:00"))).toBe("11月10日(火) 21時05分"));
});
