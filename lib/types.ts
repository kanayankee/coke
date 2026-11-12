export type Log = {
  id: string;
  at: number; // epoch ms
  type: "drink" | "skip";
  size: string;
  volumeMl: number;
  createdAt: number;
  deleted: boolean;
};

export type SizeDef = { group: string; label: string; volumeMl: number; priceYen: number; order: number };

export type Settings = {
  recordPassword: string;
  programStart: string; // YYYY-MM-DD (月曜)
  finalGoalPerWeek: number;
  stepDown: number;
  sugarGPer100ml: number;
  graduateWeeks: number;
};

export type WeekRow = {
  weekStart: string;
  stage: number;
  limit: number | null;
  actual: number | null;
  cleared: boolean | null;
};

export type WeekResult = WeekRow & { completed: boolean };

export type PublicStatus = {
  nowMs: number;
  state: "before" | "measuring" | "active" | "graduated";
  weekStart: string;
  weekEndMs: number;
  stage: number;
  limit: number | null;
  count: number;
  remaining: number | null;
  daysLeft: number;
  allowanceToday: number | null;
  skipsThisWeek: number;
  zeroStreak: number;
  lastDrink: { atMs: number; label: string; size: string; volumeMl: number } | null;
  undo: { until: number; label: string } | null;
  daily: { date: string; count: number }[];
  entries: { atMs: number; day: string; time: string; type: "drink" | "skip"; size: string }[];
  weekDays: { date: string; label: string; drinks: number; skips: number; isToday: boolean; isFuture: boolean }[];
  history: WeekResult[];
  totals: { weekMl: number; monthMl: number; weekYen: number; monthYen: number; weekSugarG: number; monthSugarG: number; hasPrices: boolean };
  sizes: SizeDef[];
  story: { template: "mid" | "clear" | "streak"; headline: string };
  programStart: string;
};
