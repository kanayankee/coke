// シートの初期構成を作る(何度実行しても、既存シートの中身は上書きしない)
// 使い方: node scripts/setup-sheets.mjs <鍵ファイルのパス>
import { google } from "googleapis";
import fs from "node:fs";
import { randomBytes } from "node:crypto";

const SPREADSHEET_ID = process.env.SPREADSHEET_ID || "1ffT8GH1Ox_m7gwY1Bp_aHaVTFsMKIzZfGrkNusQBpKc";
const key = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const auth = new google.auth.JWT({ email: key.client_email, key: key.private_key, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
const api = google.sheets({ version: "v4", auth });

const LOG_HEADER = ["id", "at", "type", "size", "volume_ml", "created_at", "deleted"];
const WEEK_HEADER = ["week_start", "stage", "limit", "actual", "cleared"];
const tabs = {
  logs: [LOG_HEADER],
  logs_dev: [LOG_HEADER],
  weeks: [WEEK_HEADER],
  weeks_dev: [WEEK_HEADER],
  sizes: [
    ["group", "label", "volume_ml", "price_yen", "order"],
    ["ペットボトル", "ペット 350", 350, 0, 1],
    ["ペットボトル", "ペット 500", 500, 0, 2],
    ["ペットボトル", "ペット 700", 700, 0, 3],
    ["マクド", "マクド S", 210, 0, 4],
    ["マクド", "マクド M", 325, 0, 5],
    ["マクド", "マクド L", 420, 0, 6],
    ["マクド", "マクド G", 650, 0, 7],
  ],
  settings: [
    ["key", "value"],
    ["record_password", "TEMP-" + randomBytes(5).toString("hex")],
    ["day_boundary_hour", 4],
    ["week_starts_on", "monday"],
    ["program_start", "2026-11-16"],
    ["final_goal_per_week", 3],
    ["step_down", 1],
    ["sugar_g_per_100ml", 11.3],
    ["graduate_weeks", 4],
  ],
};

const meta = await api.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
const existing = new Map(meta.data.sheets.map((s) => [s.properties.title, s.properties.sheetId]));

const add = Object.keys(tabs).filter((t) => !existing.has(t));
if (add.length) {
  await api.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { requests: add.map((title) => ({ addSheet: { properties: { title } } })) },
  });
}
for (const t of add) {
  await api.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${t}!A1`,
    valueInputOption: "RAW",
    requestBody: { values: tabs[t] },
  });
  console.log("created", t);
}
// 空の初期シート(シート1)は不要なので消す。中身がある場合は触らない
if (existing.has("シート1") && add.length) {
  const v = await api.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: "シート1!A1:Z50" });
  if (!(v.data.values ?? []).length) {
    await api.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests: [{ deleteSheet: { sheetId: existing.get("シート1") } }] },
    });
    console.log("removed empty シート1");
  }
}
console.log(add.includes("settings") ? "settings に仮パスワードを入れました。シートで書き換えてください" : "done");
