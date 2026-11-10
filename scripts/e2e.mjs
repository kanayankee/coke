// 開発用の動作確認(logs_dev に書く)。パスワードはシートから読み、出力しない
import { google } from "googleapis";
import fs from "node:fs";
const key = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const auth = new google.auth.JWT({ email: key.client_email, key: key.private_key, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
const api = google.sheets({ version: "v4", auth });
const SID = "1ffT8GH1Ox_m7gwY1Bp_aHaVTFsMKIzZfGrkNusQBpKc";
const st = await api.spreadsheets.values.get({ spreadsheetId: SID, range: "settings!A2:B" });
const pw = st.data.values.find((r) => r[0] === "record_password")[1];
const base = "http://localhost:3100";
const post = async (p, b) => { const r = await fetch(base + p, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }); return [r.status, await r.json()]; };
const rows = async () => (await api.spreadsheets.values.get({ spreadsheetId: SID, range: "logs_dev!A2:G" })).data.values ?? [];

let [s, j] = await post("/api/log", { password: "wrong", kind: "drink", sizeLabel: "ペット 500" });
console.log("wrong pw ->", s, j.error, "rows:", (await rows()).length);
[s, j] = await post("/api/log", { password: pw, kind: "drink", sizeLabel: "マクド L" });
console.log("record ->", s, "count", j.count, "last", j.lastDrink?.label, j.lastDrink?.size, "undo", !!j.undo, "rows:", (await rows()).length);
[s, j] = await post("/api/log", { password: pw, kind: "skip" });
console.log("skip ->", s, "skips", j.skipsThisWeek);
[s, j] = await post("/api/log", { password: pw, kind: "drink", volumeMl: 600, at: Date.now() - 3 * 86400000 });
console.log("late custom ->", s, "rows:", (await rows()).length);
[s, j] = await post("/api/undo", { password: pw });
console.log("undo ->", s, "deleted flags:", (await rows()).map((r) => r[6]).join(","));
[s, j] = await post("/api/undo", { password: "wrong" });
console.log("undo wrong pw ->", s);
