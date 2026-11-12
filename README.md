# コーラログ

コーラを飲んだ記録を残し、週ごとの上限本数を段階的に下げていく目標達成プログラムのWebアプリ。
Next.js(App Router) + Googleスプレッドシート(DB) + Vercel。企画書の Must / Should(M-1〜M-14) と Could のうち換算表示・自動更新まで実装済み。

## セットアップ

1. サービスアカウントの鍵JSONの `client_email` を、対象スプレッドシートに「編集者」として共有する。
2. シートを初期化する(既存シートの中身は上書きしない。何度実行してもよい)。

   ```bash
   node scripts/setup-sheets.mjs /path/to/key.json
   ```

   `logs` / `logs_dev` / `sizes` / `settings` / `weeks` / `weeks_dev` が作られる。
3. `.env.local` を作る(下記の環境変数)。
4. `npm install` → `npm run dev` → http://localhost:3000

テスト: `npm test`(朝4時・月曜4時の区切りとステージ進行)。

## 環境変数

| 変数名 | 中身 |
| --- | --- |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | 鍵ファイルの中身をBase64化した文字列。`base64 < key.json \| tr -d '\n'` |
| `SPREADSHEET_ID` | スプレッドシートのID |
| `LOGS_SHEET` / `WEEKS_SHEET` | 書き込み先シート名。省略時は `logs` / `weeks`。開発では `logs_dev` / `weeks_dev` を指定する |
| `CRON_SECRET` | (任意)Vercel Cron の認証用 |

`.env*` と鍵ファイルは `.gitignore` 済み。リポジトリやチャットに貼らないこと。

## デプロイ(Vercel)

プロジェクトを取り込み、`GOOGLE_SERVICE_ACCOUNT_JSON` と `SPREADSHEET_ID` を環境変数に設定する(**`LOGS_SHEET`/`WEEKS_SHEET` は設定しない**＝本番の `logs`/`weeks` に書く)。
`vercel.json` の Cron が毎週日曜19:00 UTC(＝月曜朝4時JST。`program_start` の曜日を変えたら、ここの曜日も合わせる。画面を開けば未判定の週は自動で判定されるので、動かなくても支障はない)に前週を判定して `weeks` に書き込む。Cronが動かなくても、画面を開いたときに未判定の週は自動で判定される。

## パスワードの変え方

`settings` シートの `record_password` の値を書き換えるだけ。反映は即時。
**初期値は仮のパスワード(`TEMP-...`)なので、必ず変更すること。** 「この端末で記憶する」で保存された端末は、変更後に初回の記録で弾かれ、入力し直しになる。

## シートの設定

- `settings`: `program_start`(計測週の開始日。**週の区切りは、この日と同じ曜日の朝4時になる**。月曜にすれば月曜始まり), `final_goal_per_week`(最終目標。初期値3は仮), `step_down`(クリアごとに下げる本数), `sugar_g_per_100ml`(糖分。初期値11.3は仮。ラベルで確認), `graduate_weeks`(最終目標を何週続けたら卒業か。初期値4)
- `sizes`: ボタンの追加・変更。`price_yen` は0のままだと金額表示は隠れる
- `weeks`: 上限は手で書き換えてよい(その週の上限として優先される)。実績とクリア可否は自動で入る

## 仕様メモ

- 1日・1週は日本時間の朝4時区切り(週は `program_start` と同じ曜日始まり。月曜開始なら月曜始まり)。計算は `lib/time.ts`。Vercel(UTC)でも同じ結果になる
- ステージ進行は `lib/status.ts`。記録と設定から毎回計算するので、記録を直せば結果も追従する
- 最初の上限 = 計測週の本数 − `step_down`(ただし最終目標を下回らない)。未達成の週は同じ上限で再挑戦
- 取り消しは記録後10分以内。行は消さず `deleted` を `TRUE` にする
- 書き込みは行の追記と一部列の更新のみ。行の削除・並べ替えはしない
- ストーリー画像は `/api/story`(1080×1920)。Noto Sans JP を Google Fonts から取得して描画する
- 閲覧APIは約60秒キャッシュ。記録・取り消し直後は破棄される
- `scripts/e2e.mjs` は開発シート(`logs_dev`)向けの動作確認用
