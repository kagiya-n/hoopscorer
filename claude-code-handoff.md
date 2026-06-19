# Claude Code 引き継ぎプロンプト — hoopscorer（バスケ・スタッツ記録 Web アプリ）

> このファイルをそのまま Claude Code に貼り付けてください。あわせて、プロトタイプ `hoops-stat-tracker.html` をリポジトリ直下（または `reference/`）に置いてください。このプロンプト単体で全文脈が分かるように書いてあります。

---

## 0. あなた（Claude Code）への依頼サマリ

既存の単一HTMLプロトタイプを、**Git リポジトリ化 → 保守可能な構成にリファクタ → PWA化 → コンテナ化 → GCP Cloud Run にデプロイ**してほしい。挙動とUX・日本語コピーは現状を維持すること。まず最初に「リポジトリ構成・採用スタック・タスク順序」の短い計画を提示し、合意できたら実装に入り、意味のある単位でコミットを刻んでいってほしい。

**名前の統一**：リポジトリ名・Cloud Run サービス名・`package.json` の name は、すべて **`hoopscorer`** に揃えること。

---

## 1. プロダクト概要

ピックアップ／リーグのバスケ試合で、**観戦者（記録係）一人が**両チーム全選手のスタッツをライブ入力するための Web アプリ。スマホ片手での操作を想定したモバイルファースト。

入力手段は3つで、**すべて同一のパーサーに通る**のが設計の肝：
1. タップ（選手チップ → 項目ボタン）
2. 音声（Web Speech API、日本語）
3. テキスト（音声と同じ書式を手入力）

書式は一貫して「**チーム ＋ 選手（背番号 or 名前）＋ 項目**」。例：「濃10 スリー」「淡 サトウ アシスト」。

---

## 2. 背景と設計判断（なぜこうなっているか ＝ 壊さないでほしい意図）

- **プレー中の本人入力は構造的に不可能**なので、観戦者（記録係）が入れる前提。これは既存スタッツアプリ共通の前提でもある。
- 既存のタップ型アプリの弱点は「試合が動く中でグリッドから正しいボタンを探させる＝視線がコートから外れる」点。**音声入力はこの摩擦を消す**ためのコア機能。記録係が画面を見ずに喋るだけで記録できることに価値がある。
- この用途の語彙は「チーム名／トーン ＋ 背番号 or 選手名 ＋ 項目名」の**極小・定型**。だから重いNLP/LLMは不要で、キーワード＋数値抽出の軽量パーサーで成立する（＝サーバー不要・オフライン可・低レイテンシ）。**この方針は維持**。曖昧発話の救済が必要になった段階で初めてLLMフォールバックを検討する、くらいの温度感。
- 一人で両チーム×多数の項目をライブ記録するのは負荷が高い。そのため**片チーム集中モード**を用意して負荷を下げられるようにしてある。
- デフォルトのチーム識別は実際のピックアップに合わせ「**濃／淡**」（ビブスの色）。背番号が無い・揃っていない草バスケを想定し、**背番号でも名前（ニックネーム）でも**識別できる。

---

## 3. 現状（プロトタイプの実装）

`hoops-stat-tracker.html` 1ファイル。**ビルド不要・外部依存は Google Fonts (Oswald) のみ**。バニラ HTML/CSS/JS。

アーキテクチャ概略：
- 単一の `state` オブジェクトに全状態を集約：`teams`（A=濃 / B=淡、各 `name`・`tone`・`players[]`）、`statIds`（有効な項目の順序付き配列）、`customs[]`（独自項目定義）、`focus`（`'both'|'A'|'B'`）、`armed`（選択中の選手）、`events[]`（記録イベント `{id,team,playerId,statId,src}`）。
- `render()` が `state` から全UIを毎回再構築（チップ／項目ボタン／スコア／フィード／ボックススコア）。
- `parse(raw)` が入力文字列を `{team, player, stat}` に解決。音声・テキスト共通。全角→半角正規化、チーム名/トーン語、項目キーワード、最初の数値（背番号）、選手名サブストリング一致で解決。
- `PRESETS` に項目定義（id/label/sub/pts/kw）。得点系は `pts`（2点=2, 3P=3, FT=1）を持ち、**チームスコアは pts の合計で算出**。
- **localStorage 永続化**：`storeOK()` で可否判定し、`persist()`/`restore()`。**保存が使えない環境（サンドボックス等）ではメモリ動作に自動フォールバック**して壊れない。この堅牢性は維持。
- 音声は `webkitSpeechRecognition`（`lang='ja-JP'`）。非対応／権限拒否時はマイクボタンを無効化し、テキスト入力欄にフォールバック。
- ロスター編集はテキストエリアに「1行1人（`10 タナカ` / `サトウ` / `23`）」。保存時に既存選手と背番号→名前の順で突合して `id` を保持し、消えた選手の `events` は剪定。

---

## 4. 実装済み機能の一覧（リグレッション防止チェックリスト）

- [ ] スコアボード（濃 : 淡）、得点は得点系項目から自動集計
- [ ] タップ入力：選手チップを選択 → 項目ボタンで記録、押下フラッシュ
- [ ] 音声入力（ja-JP）：「濃10 スリー」等を認識→記録、トースト確認
- [ ] テキスト入力：同書式を手入力、Enter で記録
- [ ] チーム名変更（デフォルト「濃／淡」、配色も濃淡で区別）
- [ ] 選手は背番号＋ニックネーム両対応、表示は名前優先
- [ ] 項目の増減：プリセット9種（2点/3P/FT/REB/AST/STL/BLK/PF/TO）の ON/OFF、独自項目（点数付き）の追加・削除。ボックススコア列も連動
- [ ] 片チーム集中モード（両チーム / 濃 / 淡）。集中時は入力もボックスも対象チームのみ
- [ ] 直前取り消し・試合リセット（確認ダイアログ付き）
- [ ] プレイ・バイ・プレイのフィード（入力元バッジ：タップ/音声/入力）
- [ ] ボックススコア（横スクロール、PTS＋有効項目の列、合計行）
- [ ] localStorage 自動保存＋フォールバック

---

## 5. ゴール／成果物

### 5.1 リポジトリ整備
- `git init`、適切な `.gitignore`（`node_modules/`, `dist/`, `.env*`, `.DS_Store` など）。
- `README.md`：プロジェクト概要、ローカル開発手順、デプロイ手順、採用スタックとその理由を記載。
- プロトタイプ HTML は `reference/hoops-stat-tracker.html` として残し、**挙動の正（仕様）**として扱う。
- 意味のある単位でコミット（例：scaffold / refactor:state / refactor:parser / feat:pwa / chore:docker / docs:readme）。

### 5.2 リファクタ方針（推奨）
**推奨スタック：Vite + TypeScript（フレームワークなしのバニラ）。** 理由：アプリ規模が小さくフレームワークは過剰だが、型安全とモジュール分割の恩恵は欲しいため。現状の素のHTML/JSのまま静的配信する選択肢も可。**最終判断はあなたが行い、理由を README に明記**してほしい。

推奨ファイル構成（Vite採用時の例）：
```
/
├─ index.html
├─ src/
│  ├─ main.ts          # 起動・イベント結線
│  ├─ state.ts         # state 型と初期値
│  ├─ storage.ts       # localStorage（フォールバック付き）
│  ├─ presets.ts       # 項目定義
│  ├─ parse.ts         # 音声/テキスト共通パーサー
│  ├─ render.ts        # state→DOM 再構築
│  └─ styles.css
├─ public/
│  ├─ manifest.webmanifest
│  └─ icons/           # 192/512 png
├─ reference/hoops-stat-tracker.html
├─ Dockerfile
├─ nginx.conf
├─ .dockerignore
├─ .gitignore
├─ package.json
└─ README.md
```
リファクタ時の必須事項：**機能一覧（§4）の挙動を1つも落とさない**こと。パーサーはユニットテスト（vitest 等）を数本書いて主要ケース（背番号/名前/チーム省略/曖昧/未登録）を固定すると安全。

### 5.3 PWA化（強く推奨）
体育館は Wi-Fi が弱いことが多く、記録係はアプリのように使いたい。**オフライン動作＋ホーム画面追加**に対応させる。`vite-plugin-pwa` でマニフェスト＋Service Worker を生成し、静的アセットをキャッシュ。データは既に localStorage なのでオフラインで完結する。

### 5.4 コンテナ化（Cloud Run 向け静的配信）
現状はクライアント完結（バックエンド無し）なので、**静的ファイルを配信するコンテナ**でよい。Cloud Run は `$PORT`（既定 8080）で待ち受ける必要があるため **nginx を 8080 で listen** させる。

`Dockerfile`（Viteビルド採用時）:
```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
```
（素のHTMLのまま配信するなら build ステージを省き、HTMLを直接コピーするだけでよい。）

`nginx.conf`:
```nginx
server {
  listen 8080;
  server_name _;
  root /usr/share/nginx/html;
  index index.html;
  location / { try_files $uri $uri/ /index.html; }
}
```

### 5.5 Cloud Run デプロイ
**認証・プロジェクト設定はユーザー本人が実施**（あなたは GCP 認証情報を扱わないこと）。あなたは設定ファイルとコマンドを用意し、必要なら認証済みシェル上で実行する。リージョンは東京 `asia-northeast1` を既定とする。

ユーザーが一度だけ実行：
```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
```
デプロイ（Dockerfile を自動利用、Cloud Build 経由）：
```bash
gcloud run deploy hoopscorer \
  --source . \
  --region asia-northeast1 \
  --allow-unauthenticated \
  --port 8080
```
`--allow-unauthenticated` は公開Webアプリ前提。完了後に払い出される `https://...run.app` の URL を README に記載。**HTTPS なので音声入力（Web Speech API）の secure-context 要件も満たす。**

### 5.6 CI/CD（任意・次段）
GitHub にリモートを作成して push（リモート作成と push 認証はユーザー側）。その後、Cloud Build トリガー（main への push で自動デプロイ）か GitHub Actions（Workload Identity Federation 推奨、サービスアカウント鍵は使わない）を提案・設定してよい。MVP段階では手動デプロイで十分。

---

## 6. 守ってほしい制約（ガードレール）

- 機能一覧（§4）と日本語コピー・モバイル前提のUXを維持。勝手に英語化・簡素化しない。
- 「タップ／音声／テキストが同一パーサーを通る」設計を崩さない。
- localStorage は**フォールバック付き**を維持（保存不可環境でクラッシュさせない）。
- 音声は Web Speech API 依存。**ブラウザ対応に差がある**（Chrome/Edge は良好、iOS Safari は限定的）。テキスト入力フォールバックは常に残す。
- 秘密情報をコミットしない。GCP 認証情報・トークン類はあなたが直接扱わない。
- 過剰なアニメーション・装飾を足さない（記録係が一瞬で使えることが最優先）。

---

## 7. 既知の課題・次の判断ポイント（READMEに「Backlog」として残してほしい）

- **音声の名前認識精度**：カタカナ名のヒットがぶれやすい。背番号優先の解決、認識結果の確認/訂正ステップ、ニックネーム辞書などを検討。
- **入力画面の密度**：9項目だとタップUIが詰まる。並びの最適化、よく使う項目の優先表示、音声主体運用の想定。
- **FT/FG の成功率**：現状は「成功」のみ記録（試投・ミスは未記録）。FT%・FG% を出すなら made/missed/attempts のモデル拡張が必要。やるなら両チーム対称に。
- **ロスター突合のエッジケース**：同一背番号の重複、改名時の id 維持、空行処理。
- **データ書き出し**：スタッツアプリとして CSV エクスポートはほぼ確実に欲しくなる。
- **クロスデバイス同期**：現状はスコープ外（localStorage のみ＝端末ローカル）。複数端末・共有が必要になったら Firestore 等のバックエンド＋API を別途設計（Cloud Run は API も同居可能）。

---

## 8. 進め方（推奨タスク順）

1. プロトタイプ `reference/hoops-stat-tracker.html` を読み、挙動を把握。
2. 構成・スタックの計画を短く提示（合意を取る）。
3. scaffold（Vite+TS or 素のまま）→ §4 を満たすようにモジュール分割リファクタ。
4. パーサーのユニットテストを数本固定。
5. PWA 化（manifest + SW + アイコン）。
6. Dockerfile / nginx.conf / .dockerignore を追加し、ローカルで `docker build && docker run -p 8080:8080` 動作確認。
7. README にローカル/デプロイ手順・スタック理由・Backlog を記載。
8. `gcloud run deploy --source .` でデプロイ（認証はユーザー）。URL を README に記載。
9. （任意）CI/CD を提案・設定。
