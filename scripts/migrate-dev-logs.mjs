// logs_dev の記録を logs にコピーする(idが同じ行は飛ばすので、何度実行しても安全)。logs_dev は消さない
// 使い方: node scripts/migrate-dev-logs.mjs <鍵ファイル> [--apply]  (--applyなしは確認だけ)
import { google } from "googleapis";
import fs from "node:fs";
const key = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const auth = new google.auth.JWT({ email: key.client_email, key: key.private_key, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
const api = google.sheets({ version: "v4", auth });
const spreadsheetId = process.env.SPREADSHEET_ID || "1ffT8GH1Ox_m7gwY1Bp_aHaVTFsMKIzZfGrkNusQBpKc";
const get = async (r) => (await api.spreadsheets.values.get({ spreadsheetId, range: r, valueRenderOption: "UNFORMATTED_VALUE" })).data.values ?? [];
const dev = await get("logs_dev!A2:G");
const prod = await get("logs!A2:G");
const have = new Set(prod.map((r) => r[0]));
const todo = dev.filter((r) => r[0] && !have.has(r[0])).sort((a, b) => String(a[1]).localeCompare(String(b[1])));
console.log(`logs_dev ${dev.length}行 / logs ${prod.length}行 -> コピー対象 ${todo.length}行`);
if (process.argv[3] === "--apply" && todo.length) {
  await api.spreadsheets.values.append({ spreadsheetId, range: "logs!A:G", valueInputOption: "RAW", insertDataOption: "INSERT_ROWS", requestBody: { values: todo } });
  console.log("logs に追記しました");
}
