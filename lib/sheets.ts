import { google } from "googleapis";
import { randomUUID } from "node:crypto";
import { toJstIso } from "./time";
import type { Log, Settings, SizeDef, WeekRow } from "./types";

const LOGS = () => process.env.LOGS_SHEET || "logs";
const WEEKS = () => process.env.WEEKS_SHEET || "weeks";
const ID = () => {
  const v = process.env.SPREADSHEET_ID;
  if (!v) throw new Error("SPREADSHEET_ID が未設定です");
  return v;
};

let client: ReturnType<typeof google.sheets> | null = null;
function sheets() {
  if (client) return client;
  const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!b64) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON が未設定です");
  const key = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
  const auth = new google.auth.JWT({
    email: key.client_email,
    key: key.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  client = google.sheets({ version: "v4", auth });
  return client;
}

type Cell = string | number | boolean | null | undefined;
const str = (v: Cell) => (v == null ? "" : String(v));
const num = (v: Cell, d = 0) => {
  const n = Number(v);
  return v === "" || v == null || Number.isNaN(n) ? d : n;
};
const bool = (v: Cell) => v === true || str(v).toUpperCase() === "TRUE";

export type SheetData = { logs: Log[]; sizes: SizeDef[]; settings: Settings; weeks: WeekRow[] };

export async function loadAll(): Promise<SheetData> {
  const res = await sheets().spreadsheets.values.batchGet({
    spreadsheetId: ID(),
    ranges: [`${LOGS()}!A2:G`, "sizes!A2:E", "settings!A2:B", `${WEEKS()}!A2:E`],
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  const [lg, sz, st, wk] = (res.data.valueRanges ?? []).map((r) => (r.values ?? []) as Cell[][]);

  const logs: Log[] = lg
    .filter((r) => r[0] && r[1])
    .map((r) => ({
      id: str(r[0]),
      at: Date.parse(str(r[1])),
      type: (str(r[2]) === "skip" ? "skip" : "drink") as Log["type"],
      size: str(r[3]),
      volumeMl: num(r[4]),
      createdAt: Date.parse(str(r[5])) || Date.parse(str(r[1])),
      deleted: bool(r[6]),
    }))
    .filter((l) => !Number.isNaN(l.at));

  const sizes: SizeDef[] = sz
    .filter((r) => r[1])
    .map((r) => ({ group: str(r[0]), label: str(r[1]), volumeMl: num(r[2]), priceYen: num(r[3]), order: num(r[4]) }))
    .sort((a, b) => a.order - b.order);

  const kv = new Map(st.map((r) => [str(r[0]), str(r[1])]));
  const settings: Settings = {
    recordPassword: kv.get("record_password") ?? "",
    programStart: kv.get("program_start") || "2026-11-16",
    finalGoalPerWeek: num(kv.get("final_goal_per_week"), 3),
    stepDown: Math.max(1, num(kv.get("step_down"), 1)),
    sugarGPer100ml: num(kv.get("sugar_g_per_100ml"), 11.3),
    graduateWeeks: Math.max(1, num(kv.get("graduate_weeks"), 4)),
  };

  const weeks: WeekRow[] = wk
    .filter((r) => r[0])
    .map((r) => ({
      weekStart: str(r[0]),
      stage: num(r[1]),
      limit: r[2] === "" || r[2] == null ? null : num(r[2]),
      actual: r[3] === "" || r[3] == null ? null : num(r[3]),
      cleared: r[4] === "" || r[4] == null ? null : bool(r[4]),
    }));

  return { logs, sizes, settings, weeks };
}

/** logs シートに1行追記する(削除・並べ替えはしない) */
export async function appendLog(input: { at: number; type: "drink" | "skip"; size: string; volumeMl: number }) {
  const id = randomUUID();
  const now = Date.now();
  await sheets().spreadsheets.values.append({
    spreadsheetId: ID(),
    range: `${LOGS()}!A:G`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [[id, toJstIso(input.at), input.type, input.size, input.volumeMl, toJstIso(now), "FALSE"]],
    },
  });
  return id;
}

/** 取り消し: 該当行の deleted 列だけを TRUE にする */
export async function markDeleted(id: string) {
  const s = sheets();
  const col = await s.spreadsheets.values.get({ spreadsheetId: ID(), range: `${LOGS()}!A:A` });
  const idx = (col.data.values ?? []).findIndex((r) => r[0] === id);
  if (idx < 1) throw new Error("対象の記録が見つかりません");
  await s.spreadsheets.values.update({
    spreadsheetId: ID(),
    range: `${LOGS()}!G${idx + 1}`,
    valueInputOption: "RAW",
    requestBody: { values: [["TRUE"]] },
  });
}

/** weeks シートへ、無い週は追記・ある週は差分のある行だけ更新 */
export async function syncWeeks(computed: WeekRow[], existing: WeekRow[]) {
  const s = sheets();
  const pos = new Map(existing.map((w, i) => [w.weekStart, { w, row: i + 2 }]));
  const toAppend: (string | number)[][] = [];
  for (const c of computed) {
    const cell = (v: unknown) => (v == null ? "" : typeof v === "boolean" ? (v ? "TRUE" : "FALSE") : (v as string | number));
    const row = [c.weekStart, c.stage, cell(c.limit), cell(c.actual), cell(c.cleared)];
    const hit = pos.get(c.weekStart);
    if (!hit) toAppend.push(row);
    else if (hit.w.actual !== c.actual || hit.w.cleared !== c.cleared || hit.w.stage !== c.stage) {
      // 上限は手で書き換えられるので、既存の値を保ったまま実績とクリア可否だけ更新する
      await s.spreadsheets.values.update({
        spreadsheetId: ID(),
        range: `${WEEKS()}!B${hit.row}:E${hit.row}`,
        valueInputOption: "RAW",
        requestBody: { values: [[c.stage, cell(hit.w.limit ?? c.limit), cell(c.actual), cell(c.cleared)]] },
      });
    }
  }
  if (toAppend.length) {
    await s.spreadsheets.values.append({
      spreadsheetId: ID(),
      range: `${WEEKS()}!A:E`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: toAppend },
    });
  }
}
