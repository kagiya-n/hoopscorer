# hoopscorer

ピックアップ／リーグのバスケ試合で、**観戦者（記録係）一人が**両チーム全選手のスタッツをライブ入力するための、モバイルファーストの Web アプリ。

入力手段はタップ・音声（Web Speech API・日本語）・テキストの3つで、**すべて同一のパーサーに通る**のが設計の核。書式は「**チーム ＋ 選手（背番号 or 名前）＋ 項目**」で統一されており、例えば「濃10 スリー」「淡 サトウ アシスト」のように発話／入力する。

クライアント完結（バックエンドなし）。データは `localStorage` に自動保存され、保存できない環境ではメモリ動作にフォールバックする。

---

## スタック

| 項目 | 採用 | 理由 |
| --- | --- | --- |
| ビルド | **Vite + TypeScript（バニラ）** | アプリ規模が小さく React/Vue 等のフレームワークは過剰。一方で `state`／`parse` の型固定とモジュール分割の恩恵は欲しいので TypeScript を選択。 |
| テスト | **vitest** | パーサーの主要ケース（背番号／名前／チーム省略／曖昧／未登録）を固定してリファクタ時のリグレッションを防ぐ。 |
| PWA | **vite-plugin-pwa**（autoUpdate / generateSW） | 体育館は Wi-Fi が弱いことが多く、オフライン動作とホーム画面追加に対応させたい。静的アセットを Workbox でプリキャッシュ。 |
| 配信 | **nginx:alpine（Cloud Run、`$PORT=8080` で待ち受け）** | バックエンド不要なので静的ファイル配信で十分。Cloud Run は HTTPS なので Web Speech API の secure-context 要件も自然に満たす。 |

---

## ディレクトリ構成

```
.
├─ index.html
├─ src/
│  ├─ main.ts        # 起動・イベント結線・設定パネル・音声認識
│  ├─ state.ts       # 状態の型と初期値
│  ├─ storage.ts     # localStorage（フォールバック付き）
│  ├─ presets.ts     # 項目定義（2点/3P/FT/REB/AST/STL/BLK/PF/TO）
│  ├─ parse.ts       # 音声／テキスト共通パーサー
│  ├─ render.ts      # state → DOM 再構築
│  ├─ styles.css
│  └─ __tests__/parse.test.ts
├─ public/
│  ├─ favicon.svg
│  └─ icons/icon-{192,512}.png
├─ scripts/generate-icons.mjs   # SVG → PNG アイコン生成
├─ reference/hoops-stat-tracker.html   # プロトタイプ（挙動の正＝仕様書）
├─ Dockerfile / nginx.conf / .dockerignore
└─ package.json / tsconfig.json / vite.config.ts
```

---

## ローカル開発

前提：Node.js 20+。

```bash
npm install
npm run dev            # http://localhost:5173 で起動
npm run test           # パーサーのユニットテスト
npm run build          # 型チェック + 本番ビルド（dist/）
npm run preview        # build 後の dist/ をローカル配信
npm run icons          # PWA 用 PNG アイコンを再生成
```

---

## Docker（Cloud Run 互換コンテナ）

```bash
docker build -t hoopscorer .
docker run --rm -p 8080:8080 hoopscorer
# http://localhost:8080
```

nginx は **`$PORT`=8080** で待ち受けるよう `nginx.conf` に固定済み。Service Worker / manifest はキャッシュさせず、ハッシュ付き静的アセット（`/assets/`）は1年 immutable。

---

## Cloud Run へのデプロイ

GCP 認証は **利用者本人** が実施する（このリポジトリには認証情報を含めない）。一度だけ：

```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
```

デプロイ（`Dockerfile` を Cloud Build が自動利用）：

```bash
gcloud run deploy hoopscorer \
  --source . \
  --region asia-northeast1 \
  --allow-unauthenticated \
  --port 8080
```

完了後に表示される `https://hoopscorer-xxxxx.a.run.app` を本 README のここに追記してください：

- 本番 URL： https://hoopscorer-748541005305.asia-northeast1.run.app
- GCP プロジェクト： `kagiya-n` ／ リージョン：`asia-northeast1` ／ サービス名：`hoopscorer`

`--allow-unauthenticated` は公開Webアプリ前提。HTTPS で配信されるので **Web Speech API の secure-context 要件**（マイク利用に必須）も満たします。

---

## CI/CD（次段／任意）

MVP 段階では手動 `gcloud run deploy` で十分。GitHub にリモートを置いた後、以下のどちらかを検討：

- **Cloud Build トリガー**：main への push で自動デプロイ。設定はコンソールから。
- **GitHub Actions**：Workload Identity Federation を推奨（サービスアカウント鍵をリポジトリに置かない）。

---

## 設計の核（壊さないでほしい意図）

- **同一パーサー**：タップ・音声・テキストの3入力はすべて [src/parse.ts](src/parse.ts) を通る。書式は「チーム ＋ 選手 ＋ 項目」。
- **キーワード＋数値抽出のみ**：語彙は極小・定型なので重い NLP/LLM は不要。サーバー不要・オフライン可・低レイテンシ。曖昧発話の救済が必要になった段階で初めて LLM フォールバックを検討する温度感。
- **localStorage フォールバック**：保存できない環境（プレビュー、プライベートモード等）でも**クラッシュさせず**メモリ動作で続行する（[src/storage.ts](src/storage.ts)）。
- **デフォルトの「濃／淡」**：背番号がない・揃っていない草バスケを想定し、ビブスの色（濃／淡）でチームを識別。背番号でも名前（ニックネーム）でも入力できる。
- **片チーム集中モード**：一人で両チーム × 多数項目を捌くのは負荷が高いため、片チームに絞れるセグメントを用意。

仕様の最終的な正（リグレッション防止の基準）は [reference/hoops-stat-tracker.html](reference/hoops-stat-tracker.html) 単体プロトタイプ。挙動が分からなくなったら必ずここに当たること。

---

## Backlog（既知の課題・次の判断ポイント）

- **音声の名前認識精度**：カタカナ名のヒットがぶれやすい。背番号優先の解決、認識結果の確認／訂正ステップ、ニックネーム辞書などを検討。
- **入力画面の密度**：9項目だとタップ UI が詰まる。並びの最適化、よく使う項目の優先表示、音声主体運用への寄せ。
- **FT／FG の成功率**：現状は「成功」のみ記録（試投・ミスは未記録）。% を出すなら `made/missed/attempts` のモデル拡張が必要。両チーム対称に。
- **ロスター突合のエッジケース**：同一背番号の重複、改名時の id 維持、空行処理。
- **データ書き出し**：CSV エクスポートはほぼ確実に欲しくなる。
- **クロスデバイス同期**：現状はスコープ外（`localStorage` のみ＝端末ローカル）。複数端末・共有が必要になったら Firestore 等のバックエンド＋API を別途設計（Cloud Run は API も同居可能）。
