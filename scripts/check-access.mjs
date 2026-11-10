import { google } from "googleapis";
import fs from "node:fs";
const key = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const auth = new google.auth.JWT({ email: key.client_email, key: key.private_key, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
const sheets = google.sheets({ version: "v4", auth });
try {
  const r = await sheets.spreadsheets.get({ spreadsheetId: "1ffT8GH1Ox_m7gwY1Bp_aHaVTFsMKIzZfGrkNusQBpKc" });
  console.log("OK", r.data.sheets.map(s => s.properties.title));
} catch (e) { console.log("NG", e.code, e.message); }
