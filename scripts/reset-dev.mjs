// 開発用シート(logs_dev / weeks_dev)のデータ行を消してヘッダーだけに戻す。本番シートには触れない
import { google } from "googleapis";
import fs from "node:fs";
const key = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const auth = new google.auth.JWT({ email: key.client_email, key: key.private_key, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
const api = google.sheets({ version: "v4", auth });
const spreadsheetId = process.env.SPREADSHEET_ID || "1ffT8GH1Ox_m7gwY1Bp_aHaVTFsMKIzZfGrkNusQBpKc";
const apply = process.argv[3] === "--apply";
for (const [name, range] of [["logs", "A2:G"], ["logs_dev", "A2:G"], ["weeks", "A2:E"], ["weeks_dev", "A2:E"]]) {
  const v = await api.spreadsheets.values.get({ spreadsheetId, range: `${name}!${range}` });
  console.log(name, "データ行:", (v.data.values ?? []).length);
  if (apply && name.endsWith("_dev") && (v.data.values ?? []).length) {
    await api.spreadsheets.values.clear({ spreadsheetId, range: `${name}!${range}` });
    console.log("  -> クリアしました");
  }
}
