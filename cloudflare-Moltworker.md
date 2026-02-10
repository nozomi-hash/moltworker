# **OpenClaw（旧Clawdbot）Moltworker セットアップ指示書**

最終更新：2026年2月8日 対象：Google Antigravity または Claude Code を使って OpenClaw を Cloudflare 上にデプロイする

---

## **事前準備（セットアップ開始前に全て完了すること）**

* \[ \] 個人用 Gmail アカウント（Antigravity 用）  
* \[ \] GitHub アカウント  
* \[ \] Node.js 18 以上インストール済み  
* \[ \] クレジットカードまたは PayPal アカウント（Cloudflare Workers Paid $5/月の支払い用。PayPal 推奨）  
* \[ \] **LLM API キー（AI Gateway 経由で設定する）：以下の優先順で選択**  
  * **① Gemini API（無料・まずはこれ）** → https://aistudio.google.com/apikey でキー取得。無料枠内なら課金なし  
  * **② Anthropic API（有料・高性能）** → https://console.anthropic.com/ でキー取得・残高チャージ済み  
* \[ \] Windows の場合：WSL をインストール済み（`wsl --install`）、以降 WSL 内で作業する。さらに `git config --global core.autocrlf input` を実行済みであること（STEP 3 参照）

### **LLM プロバイダーの選び方**

|  | ① Google Gemini（まずはこれ） | ② Anthropic（Claude） |
| ----- | ----- | ----- |
| 料金 | **無料枠あり**（レート制限内なら $0） | 従量課金（残高チャージ必須） |
| 推論性能 | 基本的な監視・リマインダーには十分 | 高い（特にコーディング・複雑な指示） |
| 推奨用途 | **初回セットアップ・お試し・軽量利用・コスト重視** | 本格運用・高度なタスク自動化 |
| 設定難易度 | キー発行 → AI Gateway 設定（チャージ不要） | キー発行 → 残高チャージ → AI Gateway 設定 |
| 設定経路 | **AI Gateway 経由（必須）** | **AI Gateway 経由（推奨）** |

**推奨手順：まず Gemini 無料枠で動作確認 → 必要に応じて Claude に切り替え。** 切り替えは AI Gateway の設定変更だけで完了し、再デプロイ不要。

⚠️⚠️⚠️ **Gemini API 課金トラップに注意** ⚠️⚠️⚠️

Gemini API の無料枠を使うには**必ず以下を守ること**。守らないと気づかないうちに課金が始まる。

1. **Google AI Studio で API キーを発行する際、既存の課金済み GCP プロジェクトを選ばない**。新規の専用プロジェクトを作成する  
2. 発行後、Google AI Studio の API キー一覧で **「Free」と表示されていることを確認**する。「Tier 1」「Tier 2」等と表示されている場合はそのキーは課金対象  
3. **GCP プロジェクトの課金（Cloud Billing）を有効にしない**。課金を有効にすると、無料枠超過分が自動的にクレジットカードに請求される  
4. 万一 Cloud Billing を有効化してしまった場合：GCP コンソール → 課金 → 該当プロジェクト → **「課金を無効にする」** で解除する  
5. GCP 初回登録時の「90日間 $300 無料トライアル」は Gemini API 無料枠とは別物。トライアル終了後に自動課金に移行するため、**不要なら GCP 無料トライアルには登録しない**  
6. Gemini 無料枠のレート制限（例：1分15リクエスト、1日1,500リクエスト）を超えるとエラー（HTTP 429）が返る。エラーが出た場合は制限リセットまで待つ。課金プランに移行しなければ料金は発生しない

---

## **STEP 1：Cloudflare アカウント作成 & Workers Paid 課金**

⚠️⚠️⚠️ **このステップは「アカウント登録」と「Workers Paid 課金」の2段階ある。両方完了しないとデプロイできない。登録だけで課金を忘れるケースが非常に多い。** ⚠️⚠️⚠️

### **第1段階：アカウント登録**

1. https://dash.cloudflare.com/sign-up でアカウント作成  
2. 確認メールのリンクをクリック  
3. ダッシュボードにログインできることを確認

→ **ここで終わりではない。次の課金ステップに進む。**

### **第2段階：Workers Paid プラン課金（$5/月）**

4. ダッシュボード左メニュー → **Workers & Pages**  
5. **Plans** → **Workers Paid ($5/月)** を選択  
6. 支払い方法を登録する：

| 支払い方法 | 推奨度 | 備考 |
| ----- | ----- | ----- |
| **PayPal** | **◎ 推奨** | 即時反映。カード情報を Cloudflare に直接渡さずに済む。解約・変更も PayPal 側で管理できる |
| クレジットカード | ○ | 問題なく使えるが、カード番号を直接入力する必要がある |

7. 支払い完了後、Plans 画面で **「Workers Paid」** と表示されていることを確認  
8. アカウント名横の「…」→「Copy Account ID」→ 控えておく

### **課金完了の確認方法**

ダッシュボード → Workers & Pages → Overview を開き、以下のいずれかで判定：

* Plans 欄に **「Paid」** と表示されている → ✅ OK  
* Plans 欄が **「Free」** のまま → ❌ 課金未完了。上記手順 4〜7 をやり直す

⚠️ 課金が「Free」のままデプロイすると、**課金と無関係に見えるエラーメッセージ**（Sandbox 関連エラー等）が出る。エラー文に「billing」「paid」といった単語は含まれないため、原因特定が困難。**デプロイ前に必ず「Paid」表示を目視確認する。**

---

## **STEP 2：Google Antigravity インストール（Antigravity を使う場合）**

1. https://antigravity.google/download からダウンロード・インストール  
2. Gmail アカウントでログイン  
3. 開発モード → **Agent-assisted development** を選択  
4. Terminal Policy → **Auto** を選択  
5. 上部「…」メニュー → MCP ストア →「Cloudflare」を検索して追加

Claude Code を使う場合はこのステップは不要。

---

## **STEP 3：リポジトリ取得**

⚠️ **Windows ユーザーは clone 前に必ず以下を実行する：**

\# Windows の改行コード（CRLF）が混入すると、コンテナ起動時に  
\# 「exit code 126」エラーが発生してデプロイが失敗する  
git config \--global core.autocrlf input

git clone https://github.com/cloudflare/moltworker.git  
cd moltworker  
npm install

Antigravity の場合：Agent Manager →「Open Workspace」→ clone したフォルダを開く →「npm install を実行して」と指示。

---

## **STEP 4：Wrangler ログイン**

npx wrangler login

ブラウザが開く → Cloudflare アカウントで認証を許可。

---

## **STEP 5：シークレット設定**

以下を順番に実行する。各コマンド実行後にプロンプトが出るので値を入力して Enter。

### **5-1. LLM API キー（AI Gateway 経由で設定する）**

⚠️ **LLM の API キーは全て AI Gateway 経由で設定する。** STEP 8 で AI Gateway を先に作成してから、このステップに戻る。

**① Gemini API を使う場合（無料・推奨）：**

npx wrangler secret put CLOUDFLARE\_AI\_GATEWAY\_API\_KEY  
\# → Google AI Studio で取得した Gemini API キーを入力

npx wrangler secret put CLOUDFLARE\_AI\_GATEWAY\_ID  
\# → STEP 8 で作成した AI Gateway の ID を入力

npx wrangler secret put CF\_AI\_GATEWAY\_MODEL  
\# → google/gemini-3-flash と入力（無料枠で使える高速モデル）

**② Anthropic（Claude）を使う場合（有料・高性能）：**

npx wrangler secret put CLOUDFLARE\_AI\_GATEWAY\_API\_KEY  
\# → console.anthropic.com で取得した Anthropic API キーを入力

npx wrangler secret put CLOUDFLARE\_AI\_GATEWAY\_ID  
\# → STEP 8 で作成した AI Gateway の ID を入力

\# モデル変更が必要な場合のみ（デフォルト：Claude Sonnet 4.5）  
npx wrangler secret put CF\_AI\_GATEWAY\_MODEL  
\# 例：anthropic/claude-opus-4-5

⚠️ いずれの場合も STEP 8 の AI Gateway 設定が先に必要。まだの場合は STEP 8 を先に完了してから戻る。

### **5-2. 共通シークレット（全員必須）**

\# ゲートウェイトークン生成＆設定（必須・値を必ずメモすること）  
MOLTBOT\_GATEWAY\_TOKEN=$(openssl rand \-hex 32\)  
echo "トークン: $MOLTBOT\_GATEWAY\_TOKEN"   \# ← この値をメモする  
echo "$MOLTBOT\_GATEWAY\_TOKEN" | npx wrangler secret put MOLTBOT\_GATEWAY\_TOKEN

\# Cloudflare Account ID（必須）  
npx wrangler secret put CF\_ACCOUNT\_ID  
\# → STEP 1 で控えた Account ID を入力

\# Cloudflare Access（推奨・STEP 6 の後に値が確定する）  
npx wrangler secret put CF\_ACCESS\_TEAM\_DOMAIN  
npx wrangler secret put CF\_ACCESS\_AUD

\# R2 永続ストレージ（推奨・STEP 7 の後に値が確定する）  
npx wrangler secret put R2\_ACCESS\_KEY\_ID  
npx wrangler secret put R2\_SECRET\_ACCESS\_KEY

⚠️ 手順 4・5 は後続ステップで値が確定するため、STEP 6・7 の完了後に実行してもよい。

---

## **STEP 6：Cloudflare Access 設定**

1. ダッシュボード → 左メニュー「Zero Trust」  
2. 初回：Team ドメインを設定（例：`myteam.cloudflareaccess.com`）→ 控える  
3. Access → Applications → Add an Application → **Self-hosted**  
4. Application domain：`moltworker.あなたのサブドメイン.workers.dev`  
5. ログイン方法：メール OTP または Google 認証  
6. ポリシー：自分のメールアドレスのみ許可  
7. 作成後に表示される **Application Audience (AUD)** を控える

⚠️ **メール認証コード（OTP）が届かない場合：** Access → Applications で該当アプリを開き、**「Policies assigned」が 0 になっていないか確認する。** 0 の場合は許可するメールアドレスが登録されていない状態。ポリシーを追加して自分のメールアドレスを設定すること。

確認場所：  
Zero Trust → Access → Applications → 該当アプリ  
  └── 「Policies assigned」の数字を確認  
       0 → ポリシー未設定（＝誰のメールにもコードが送られない）  
       1以上 → 正常

控えた値をシークレットに設定：

npx wrangler secret put CF\_ACCESS\_TEAM\_DOMAIN  
\# → myteam.cloudflareaccess.com

npx wrangler secret put CF\_ACCESS\_AUD  
\# → AUD 値を入力

---

## **STEP 7：R2 ストレージ設定**

1. ダッシュボード → R2 Object Storage → Create Bucket  
2. 名前：`moltbot-data`　リージョン：Auto  
3. R2 → Manage R2 API Tokens → Create API Token  
4. Permission：**Object Read & Write**、Bucket：`moltbot-data` に限定  
5. Access Key ID と Secret Access Key を控える

控えた値をシークレットに設定：

npx wrangler secret put R2\_ACCESS\_KEY\_ID  
npx wrangler secret put R2\_SECRET\_ACCESS\_KEY

---

## **STEP 8：AI Gateway 設定（全員必須）**

**AI Gateway は OpenClaw の LLM 接続の中心。** Gemini でも Claude でも、API キーはここに登録する。コスト可視化・モデル切替・プロバイダー変更が全てダッシュボードから可能になる。

### **AI Gateway の場所（ダッシュボード上のナビゲーション）**

左メニューの「ビルド」セクション内：

コンピューティングと AI  
├── Workers & Pages  
├── 観察可能性  
├── Workers for Platforms  
├── コンテナ（ベータ）  
├── Durable Objects  
├── Queues  
├── ワークフロー  
├── ブラウザ レンダリング  
├── AI Search（ベータ）  
├── Workers AI  
├── AI Gateway          ← ★ ここ  
├── VPC（ベータ）  
├── メール サービス  
└── Workers のプラン

1. 左メニュー →「**コンピューティングと AI**」→「**AI Gateway**」をクリック  
2. 「AI Gateway を始める」画面が表示される → **「ゲートウェイの作成」** ボタンをクリック  
3. Gateway 名を入力（例：`openclaw-gw`）→ 作成  
4. Gateway ID を控える（概要ページに表示される）

⚠️ **ここが LLM の API キーを登録する場所。** Worker のシークレットには Gateway の接続情報だけを渡し、API キー自体はこの Gateway で管理する。

### **プロバイダー キーの登録画面**

Gateway を作成すると、上部タブに以下が表示される：

概要 ｜ ログ ｜ Analytics ｜ ファイアウォール ｜ プロバイダー キー ｜ 動的ルート ｜ 設定  
                                                ↑ ★ ここを開く

「**プロバイダー キー**」タブを開くと、対応プロバイダーの一覧が表示される。各プロバイダーの右端に「**\+ Add**」ボタンがある。

主なプロバイダー（スクロールで全て表示される）：

| プロバイダー名 | 用途 |
| ----- | ----- |
| **Google AI Studio** | ← ① Gemini 無料枠はここ |
| **Anthropic** | ← ② Claude はここ |
| OpenAI | GPT 系（本マニュアルでは扱わない） |
| Amazon Bedrock | AWS 経由（本マニュアルでは扱わない） |
| その他多数 | DeepSeek, Mistral, Groq, Grok 等 |

### **① Gemini API（無料枠）を登録する ← まずはこれ**

1. 「**プロバイダー キー**」タブを開く  
2. **Google AI Studio** の行の「**\+ Add**」をクリック  
3. Google AI Studio で取得した API キーを貼り付けて保存

\# Worker に Gateway の接続情報を設定する  
npx wrangler secret put CLOUDFLARE\_AI\_GATEWAY\_ID  
\# → Gateway ID（「概要」タブに表示されている）

npx wrangler secret put CLOUDFLARE\_AI\_GATEWAY\_API\_KEY  
\# → Google AI Studio で取得した Gemini API キー（上でプロバイダーキーに登録したもの）

npx wrangler secret put CF\_AI\_GATEWAY\_MODEL  
\# → google/gemini-3-flash（無料枠・高速）  
\# → google/gemini-3-pro-preview（無料枠・高性能だがレート制限が厳しい）

⚠️ Gemini のモデル名を間違えると動作しない。上記のいずれかをそのまま入力する。

### **② Anthropic（Claude）を登録する ← 高性能が必要なとき**

1. 「**プロバイダー キー**」タブを開く  
2. **Anthropic** の行の「**\+ Add**」をクリック  
3. Anthropic API キーを貼り付けて保存

npx wrangler secret put CLOUDFLARE\_AI\_GATEWAY\_ID  
\# → Gateway ID（Gemini と同じ Gateway を使う場合は設定済み）

npx wrangler secret put CLOUDFLARE\_AI\_GATEWAY\_API\_KEY  
\# → Anthropic API キー

\# モデル変更が必要な場合のみ（デフォルト：Claude Sonnet 4.5）  
npx wrangler secret put CF\_AI\_GATEWAY\_MODEL  
\# 例：anthropic/claude-opus-4-5

⚠️ **Gemini と Claude の両方のプロバイダーキーを登録しておくこともできる。** どちらを使うかは Worker のシークレット（`CLOUDFLARE_AI_GATEWAY_API_KEY` と `CF_AI_GATEWAY_MODEL`）で切り替える。

### **Gemini → Claude への切り替え方法**

両方のプロバイダーキーを登録済みなら、Worker のシークレットを差し替えるだけ。再デプロイ不要。

npx wrangler secret put CLOUDFLARE\_AI\_GATEWAY\_API\_KEY  
\# → Anthropic API キーに差し替え

npx wrangler secret put CF\_AI\_GATEWAY\_MODEL  
\# → 空欄（デフォルトの Claude Sonnet 4.5 を使用）  
\# → または anthropic/claude-opus-4-5 等を指定

逆に Claude → Gemini に戻す場合も同じ要領で Gemini API キーとモデル名（`google/gemini-3-flash`）に差し替える。

---

## **STEP 9：デプロイ**

⚠️ `wrangler deploy` 単体では完了しない。Sandbox コンテナ構築のため Docker または GitHub Actions が必要。

### **方法 A：GitHub Actions（推奨）**

1. https://github.com/cloudflare/moltworker をフォーク  
2. フォーク先リポジトリ → Settings → Secrets and variables → Actions に追加：  
   * `CLOUDFLARE_API_TOKEN`（ダッシュボードで発行）  
   * `CLOUDFLARE_ACCOUNT_ID`  
3. Actions タブ → 該当ワークフロー → **Run workflow**

### **方法 B：Docker 経由**

docker \--version   \# Docker インストール確認  
npm run deploy

---

## **STEP 10：動作確認**

### **10-1. Control UI アクセス**

1. ブラウザでアクセス：`https://moltworker.あなた.workers.dev/?token=ゲートウェイトークン`  
2. Access のログイン画面 → 認証を通す  
3. Control UI が表示されることを確認

### **10-2. デバイスペアリング承認**

⚠️ **トークン認証が通っても、すぐにはチャットできない。** デバイスペアリングの承認が必要。

4. Admin UI にアクセス：`https://moltworker.あなた.workers.dev/_admin/`  
5. 「**Devices**」セクションを開く  
6. ペアリングリクエスト（Control UI のブラウザからの接続）が表示されている → **「Approve」をクリック**して承認

⚠️ 新しいブラウザ、新しい端末、シークレットブラウジングなど、**初回接続のたびにペアリング承認が必要。** 1度承認すれば同じブラウザからは再承認不要。

### **10-3. 動作確認完了**

7. Control UI でメッセージ送信 → LLM から返答が返れば完了  
8. Gemini 利用時は初回レスポンスに数秒かかる場合がある（コンテナのコールドスタート \+ Gemini API 呼び出し）

---

## **トラブルシューティング**

### **⚠️⚠️⚠️ トラブルシューティングの大原則：AI にブラウザ操作させる ⚠️⚠️⚠️**

OpenClaw のデバッグで最も厄介な問題は **Cloudflare Access（CF Access）が CLI ツールのアクセスをブロックする** こと。`curl` でエンドポイントを叩いても 302 リダイレクト、`wrangler tail` ではコンテナ内部のエラーが見えない——CLI だけでは行き詰まる場面が非常に多い。

**解決策：AI にブラウザを操作させて、CF Access 認証を通した状態でデバッグする。**

| ツール | ブラウザ操作機能 | 使い方 |
| ----- | ----- | ----- |
| **Google Antigravity**（推奨） | 内蔵ブラウザ | Antigravity にそのまま「ブラウザでこの URL を開いてログを確認して」と指示する。Antigravity が CF Access 認証を通し、Control UI・Admin UI・デバッグエンドポイントの画面を読み取って問題を特定する |
| **Claude Code** | Claude in Chrome（MCP 連携） | Claude Code に「Claude in Chrome でこの URL を開いて」と指示する。Claude Code がブラウザを操作し、CF Access 認証済みの状態でページ内容を取得・分析する |

**なぜブラウザ操作が必要か：**

問題の切り分けに必要な操作：  
  ✕ curl https://worker.dev/debug/...     → CF Access に 302 でブロックされる  
  ✕ wrangler tail                          → コンテナ内部のエラーが出ない  
  ✕ 手動でブラウザを開いてスクショ撮影     → AI に伝えるのが面倒・情報が欠落する

  ◎ AI にブラウザ操作させる               → CF Access 認証を自動で通過  
                                            → ページ内容を AI が直接読み取る  
                                            → エラー原因を即座に特定できる

**具体的な指示例：**

\# Antigravity に出す指示の例  
「Control UI にアクセスしてチャットを送信し、レスポンスが返るか確認して。  
 返らない場合は Admin UI (/\_admin/) の Devices セクションを開いて、  
 未承認のペアリングリクエストがあれば Approve して。  
 それでも返らない場合は /debug/processes と /debug/logs を開いて  
 エラー内容を教えて。」

\# Claude Code に出す指示の例  
「Claude in Chrome で https://worker.dev/?token=xxx を開いて、  
 ログイン後にチャットが動くか確認して。動かない場合は  
 AI Gateway のログタブを開いてリクエストのステータスを確認して。」

⚠️ **CLI で行き詰まったら、まず AI にブラウザ操作を依頼する。** これがこのマニュアルにおけるトラブルシューティングの第一選択。以下の表は個別の症状と対処法。

| 症状 | 原因 | 対処 |
| ----- | ----- | ----- |
| デプロイ時に謎のエラー | Workers Paid 未課金（登録だけで課金していない） | ダッシュボード → Workers & Pages → Plans で「Paid」表示を確認。「Free」なら STEP 1 第2段階をやり直す |
| チャット UI は出るが返信なし | API キー未設定 or 残高切れ | `npx wrangler secret list` で確認 → Gemini の場合は AI Studio でキーが「Free」表示か確認。Claude の場合は Anthropic ダッシュボードで残高確認 |
| トークン認証は通るが「デバイスペアリングが必要」 | 未承認デバイスからの接続 | Admin UI（`/_admin/`）→「Devices」→ ペアリングリクエストを「Approve」。新しいブラウザ・端末の初回接続では毎回必要（STEP 10-2 参照） |
| ペアリング成功（HEARTBEAT\_OK）だが応答が空 | AI Gateway → LLM の経路に問題 | AI Gateway の「ログ」タブでリクエスト状況を確認。シークレット3つ（`CLOUDFLARE_AI_GATEWAY_ID` / `_API_KEY` / `CF_AI_GATEWAY_MODEL`）の整合性を確認（ケーススタディ 0.5 参照） |
| 返信なし（API キーは正しい） | モデル ID の指定ミス（`start-moltbot.sh` 内も要確認） | 正しい ID → Claude：`claude-sonnet-4-5-20250929` / `claude-haiku-4-5-20251001`。Gemini：`google/gemini-3-flash`。⚠️ `claude-opus-4-5-20251101` は存在しない。`start-moltbot.sh` 内のハードコードも確認すること |
| 返信なし（モデル名も正しい） | Sandbox 未起動 | 初回コールドスタートに1〜2分かかる。ダッシュボード → Workers → ログ確認 |
| 返信なし（ログも正常） | デプロイ不完全 | GitHub Actions のログで全ステップ成功を確認。再実行 |
| Gemini で HTTP 429 エラー | 無料枠レート制限超過 | 制限リセットまで待つ（分単位 or 日単位）。頻繁に出る場合は Claude への切り替えを検討（STEP 8 参照） |
| Gemini で意図せず課金された | 課金済み GCP プロジェクトにキーを紐付けた | GCP コンソール → 課金 →「課金を無効にする」。新規プロジェクトで API キーを再発行して「Free」表示を確認 |
| 管理UI に認証なしでアクセスできる | Access 未設定 | STEP 6 を実施。AUD / Team Domain のシークレットを確認 |
| Access のメール認証コード（OTP）が届かない | Policies assigned が 0（ポリシー未設定） | Zero Trust → Access → Applications → 該当アプリで「Policies assigned」を確認。0 ならポリシーを追加して自分のメールアドレスを許可する（STEP 6 参照） |
| コンテナ再起動後にデータ消失 | R2 未設定 | STEP 7 を実施。3つのシークレットが全て設定済みか確認 |
| Windows でコマンドがエラー / exit code 126 | Windows の改行コード（CRLF）がシェルスクリプトに混入 | 下記「Windows 改行コード問題の対処」参照 |
| 403 / 401 エラー | トークン設定ミス | ブラウザ F12 → Network タブで確認。ゲートウェイトークン・Access 設定を再確認 |
| モデル ID 修正後にデプロイしたが応答がまだ空 | 古いコンテナプロセスが残っている or R2 バックアップが古い設定で上書き | Dockerfile のキャッシュバスト変更 \+ R2 バケット内の古い `clawdbot.json` を削除して再デプロイ（ケーススタディ 0.5・4 参照） |
| 応答が 300〜500ms で返ってくるが中身が空 | API コール自体が発生していない | `providers` が空 / `baseUrl` 未指定 / モデル ID 不正。`/debug/container-config` で設定 JSON を確認（ケーススタディ 0.5・5 参照） |
| ゲートウェイ再起動後に「Pairing required」 | localStorage に古いデバイス ID が残っている | ブラウザの localStorage をクリア → トークン URL で再アクセス → Admin UI で再 Approve |
| `curl` でデバッグエンドポイントにアクセスしても空 or 302 | CF Access がブロックしている | **AI にブラウザ操作を依頼する（Antigravity の内蔵ブラウザ / Claude Code の Claude in Chrome）。** CLI では CF Access を通過できない。上記「トラブルシューティングの大原則」参照 |

---

### **Windows 改行コード問題の対処（exit code 126）**

**症状：** デプロイは成功するが、コンテナが起動しない。ログに `exit code 126`（実行権限エラー）が出る。

**原因：** Windows の Git がファイルを checkout する際に改行コードを CRLF（`\r\n`）に変換する。Linux コンテナ内のシェルスクリプト（`start-moltbot.sh`）に CRLF が混入すると、`#!/bin/bash\r` のように余分な `\r` が付き、OS がスクリプトを実行できない。

**対処（すでに clone 済みの場合）：**

\# 1\. Git の改行コード設定を修正  
git config \--global core.autocrlf input

\# 2\. リポジトリを再 clone（既存のものは削除）  
cd ..  
rm \-rf moltworker  
git clone https://github.com/cloudflare/moltworker.git  
cd moltworker  
npm install

\# 3\. 再デプロイ  
npm run deploy

**予防策（clone 前に実行）：**

\# これを実行してから clone すれば問題は起きない  
git config \--global core.autocrlf input

⚠️ WSL（Windows Subsystem for Linux）内で作業している場合でも、Windows 側の Git を使って clone していると CRLF が混入することがある。WSL 内の Git（`/usr/bin/git`）を使って clone し直すのが確実。

---

## **ケーススタディ：「繋がったのにチャットのレスポンスが返ってこない」**

Cloudflare 経由で OpenClaw の Control UI が表示され、チャット画面も開ける。しかしメッセージを送っても返答が来ない——これは最も多い問題。以下に実際の原因と解決方法を記録する。

### **ケース0：デバイスペアリング未承認（最も多い）**

**症状：** トークン認証は通った。Control UI も表示される。しかしチャットを送っても返答がない。

**原因：** OpenClaw にはデバイスペアリング機能がある。トークン認証とは別に、**接続元のデバイス（ブラウザ、チャットアプリの DM 等）ごとに Admin UI から承認が必要。** 未承認のデバイスからのメッセージは無視される。エラーメッセージが表示されない場合もあり、原因に気づきにくい。

**対処：**

1. Admin UI にアクセス：`https://moltworker.あなた.workers.dev/_admin/`  
2. 「**Devices**」セクションを開く  
3. 未承認のペアリングリクエストが表示されている → **「Approve」をクリック**  
4. 承認後にもう一度メッセージを送信する → 返答が返る

**注意点：**

* 新しいブラウザ、新しい端末、シークレットブラウジングなど、**初回接続のたびに承認が必要**  
* 1度承認すれば同じデバイスからは再承認不要（R2 永続ストレージを設定していない場合、コンテナ再起動時にペアリング情報が失われ再承認が必要になる）  
* **⚠️ ゲートウェイ再起動後に「Pairing required」が出る場合：** ブラウザの localStorage に古いデバイス ID が残っている。ゲートウェイの新しいインスタンスはそれを認識しない。ブラウザの localStorage をクリアしてからトークン URL で再アクセスすると、新しいデバイス ID が生成されるので再度 Approve する

---

### **ケース0.5：ペアリング成功・HEARTBEAT\_OK だがモデル応答が空**

**症状：** デバイスペアリングは成功している（ログに `HEARTBEAT_OK` が返ってきている）。しかしチャットを送っても AI からの返答が空、または返ってこない。

⚠️ **重要：この問題は Worker ログ（`wrangler tail`）にエラーが出ない。** AI モデルの呼び出しは Sandbox コンテナ内部で処理されるため、Worker 側のログには WebSocket 接続成功のログしか記録されない。エラーが出ないからといって正常とは限らない。

**原因：** ペアリング・トークン認証・WebSocket 接続は全て正常だが、**AI Gateway → LLM プロバイダーの経路に問題がある。** 具体的には以下のいずれか：

1. **`start-moltbot.sh` 内のモデル ID が存在しない（実例あり）：** Moltworker のスタートアップスクリプト内にハードコードされたモデル ID が間違っている場合がある。実際に `claude-opus-4-5-20251101` という存在しないモデル ID がデフォルトで記述されていた事例あり。この場合、API は呼び出されるが空のレスポンスが返る  
2. **設定 JSON の `providers` が空になっている（実例あり）：** `clawdbot.json` 内の `models.providers` が `{}` のままだと、ゲートウェイはどの LLM プロバイダーにもリクエストを送らない。環境変数 `ANTHROPIC_API_KEY` を設定しても **自動では読み取られない** ——設定 JSON に明示的に埋め込む必要がある  
3. **`baseUrl` が設定 JSON に含まれていない（実例あり）：** OpenClaw の設定スキーマ（Zod バリデーション）では、`models.providers.anthropic` を明示的に定義する場合 `baseUrl` は省略不可の必須フィールド。未指定だとゲートウェイが起動しない。直接 API 利用でも `"baseUrl": "https://api.anthropic.com"` の明示指定が必要  
4. **AI Gateway のプロバイダーキー未登録 or 無効：** 「プロバイダー キー」タブで Google AI Studio / Anthropic に「+ Add」していない、またはキーが失効している  
5. **`CF_AI_GATEWAY_MODEL` のモデル名が間違っている：** `google/gemini-3-flash` を `gemini-3-flash`（`google/` なし）と書いた等のタイプミス  
6. **`CLOUDFLARE_AI_GATEWAY_ID` が間違っている：** Gateway ID を Account ID と取り違えた等  
7. **`CLOUDFLARE_AI_GATEWAY_API_KEY` とプロバイダーの不一致：** Gemini のモデルを指定しているのに Anthropic のキーを入れている、またはその逆  
8. **Gemini 無料枠のレート制限に達している：** エラーが返らず空レスポンスになるケースがある

**⚠️ 最大の手がかり：AI の応答時間。** ゲートウェイのログで応答が **300〜500ms で完了** している場合、**API コールが発生していない。** 実際の LLM API 呼び出しは最低でも数秒かかる。数百ミリ秒で完了しているなら、原因は上記 1〜3（モデル ID 不正 / providers 空 / baseUrl 未指定）のいずれか。

**切り分け手順：**

1. **まず `start-moltbot.sh` のモデル ID を確認する：**

\# start-moltbot.sh 内のモデル ID を検索  
grep \-n "claude\\|gemini\\|model" start-moltbot.sh | grep \-i "id\\|primary"

正しいモデル ID 一覧：

| プロバイダー | モデル ID | 備考 |
| ----- | ----- | ----- |
| Anthropic | `claude-sonnet-4-5-20250929` | ← 推奨（Sonnet 4.5） |
| Anthropic | `claude-haiku-4-5-20251001` | 軽量・高速 |
| Anthropic | `claude-opus-4-5` | Opus 4.5（日付サフィックスなし） |
| Gemini | `google/gemini-3-flash` | 無料枠・高速 |
| Gemini | `google/gemini-3-pro-preview` | 無料枠・高性能 |

⚠️ `claude-opus-4-5-20251101` は**存在しないモデル ID**。これがデフォルトで入っていた場合は修正が必要：

\# start-moltbot.sh 内の不正なモデル ID を修正する例  
\# claude-opus-4-5-20251101 → claude-sonnet-4-5-20250929 に変更  
sed \-i 's/claude-opus-4-5-20251101/claude-sonnet-4-5-20250929/g' start-moltbot.sh

修正後は再デプロイ（`npm run deploy`）が必要。Dockerfile のキャッシュバストコメントも変更してコンテナ再ビルドを強制すること。

2. Cloudflare ダッシュボード → AI Gateway → 該当 Gateway → **「ログ」タブ** を開く

3. リクエストが記録されているか確認：

   * **リクエストが記録されていない** → Gateway にリクエストが届いていない → `CLOUDFLARE_AI_GATEWAY_ID` が間違っている可能性大  
   * **リクエストが記録されている \+ エラー（4xx / 5xx）** → 下記のエラー別対処を参照  
   * **リクエストが記録されている \+ 成功（200）だが応答が空** → モデル名の問題 or プロバイダー側の問題  
4. エラー別対処：

| ログのステータス | 意味 | 対処 |
| ----- | ----- | ----- |
| 401 / 403 | API キーが無効 or プロバイダーキー未登録 | 「プロバイダー キー」タブで該当プロバイダーのキーを確認・再登録 |
| 404 | モデル名が存在しない | `CF_AI_GATEWAY_MODEL` と `start-moltbot.sh` 内のモデル ID を両方確認 |
| 429 | レート制限 | Gemini 無料枠の制限。リセットまで待つ or Claude に切り替え |
| リクエスト自体がない | Gateway ID の誤り | `CLOUDFLARE_AI_GATEWAY_ID` を「概要」タブの値と照合 |

5. シークレットの整合性を一括確認：

npx wrangler secret list  
\# 以下の3つが全て存在することを確認：  
\# \- CLOUDFLARE\_AI\_GATEWAY\_ID  
\# \- CLOUDFLARE\_AI\_GATEWAY\_API\_KEY  
\# \- CF\_AI\_GATEWAY\_MODEL

**学び：**

* `HEARTBEAT_OK` は「OpenClaw ↔ Worker ↔ ブラウザ」の接続が正常という意味であり、「OpenClaw → AI Gateway → LLM」の経路とは無関係。ペアリング成功 ≠ LLM 接続成功  
* **Worker ログ（`wrangler tail`）には AI モデル呼び出しのエラーが出ない。** コンテナ内部のログは Worker ログとは別系統。AI Gateway の「ログ」タブを確認する必要がある  
* `start-moltbot.sh` にハードコードされたモデル ID が間違っている場合、シークレット設定が全て正しくても応答が空になる  
* **⚠️ `npm run deploy` しても実行中のコンテナプロセスは再起動されない（実例あり）。** コンテナイメージは更新されるが、古い設定（無効なモデル ID）で動き続けるゲートウェイプロセスが残る。モデル ID 修正後は必ずコンテナの強制再起動が必要（後述の「コンテナ再起動の確実な方法」参照）

### **コンテナ再起動の確実な方法**

`npm run deploy` だけではコンテナ内のプロセスが古い設定のまま残ることがある。以下の手順で確実に再起動する：

\# 方法1：Dockerfile のキャッシュバストを変更して再ビルドを強制  
\# Dockerfile 内の "Build cache bust" コメントを変更する  
\# 例: \# Build cache bust: 2026-02-08-v28 → v29 に変更  
\# その後デプロイ  
npm run deploy

\# デプロイ後、コンテナの起動に1〜2分かかる  
\# Control UI で新しいセッションを作成して動作確認

⚠️ デプロイ後に「まだ動かない」場合は、古いプロセスが残っている可能性がある。1〜2分待ってから新しいセッションで再試行する。

### **デバッグ時の注意：CF Access がデバッグエンドポイントもブロックする**

`DEBUG_ROUTES=true` を設定してデバッグ用エンドポイント（`/debug/*` や `/api/debug-config`）を有効にしても、**Cloudflare Access（STEP 6）を設定済みの場合、外部からの `curl` コマンドや未認証ブラウザからはアクセスできない。** CF Access が Worker に到達する前にリクエストをブロック（302 リダイレクト）する。

デバッグエンドポイントにアクセスする方法：

| 優先順 | 方法 | 手順 |
| ----- | ----- | ----- |
| **★ 最優先** | **AI のブラウザ操作** | **Antigravity に「ブラウザでこの URL を開いて確認して」と指示する（Claude Code なら Claude in Chrome）。** AI が CF Access 認証を通してページ内容を直接読み取り、エラーを特定する。CLI で行き詰まった場合はまずこれを試す |
| 2 | CF Access 認証済みブラウザ | 自分で Control UI にログイン済みのブラウザで直接 URL を開く |
| 3 | `wrangler tail` | `npx wrangler tail --format pretty` でリアルタイムログを確認。CF Access の影響を受けないが、コンテナ内部のエラーは出ない |
| 4 | 一時的に Access ポリシーを緩和 | Zero Trust → Access → 該当アプリのポリシーに `/debug/*` パスの除外を追加（⚠️ デバッグ後に必ず戻す） |

⚠️ `curl` でデバッグしようとして「レスポンスが空」「302 が返る」場合、ほぼ確実に CF Access がブロックしている。Worker の問題ではない。**AI にブラウザ操作を依頼して CF Access を通過させるのが最も確実。**

---

### **ケース1：内部 CLI 認証トークン欠落 \+ WS プロキシの認証コンテキスト伝搬漏れ**

**症状：** Control UI は表示される。チャット入力もできる。しかし送信後にレスポンスが一切返らない。エラー表示もない。

**原因：** OpenClaw の内部アーキテクチャでは、ブラウザ（Control UI）→ Worker → Sandbox コンテナ内の Gateway という経路で WebSocket 接続が行われる。この経路の途中で認証トークンが正しく伝搬されていなかった。

具体的には以下の2つが同時に起きていた：

1. **内部 CLI の認証トークン欠落：** Sandbox コンテナ内で OpenClaw の CLI（内部プロセス）が Gateway に接続する際、`gateway.auth.token`（= `OPENCLAW_GATEWAY_TOKEN` / `MOLTBOT_GATEWAY_TOKEN`）が CLI 側に渡っていなかった。CLI は認証なしで接続を試み、Gateway が `1008 unauthorized: gateway token missing` で拒否していた  
2. **WS プロキシの認証コンテキスト伝搬漏れ：** Worker が外部からの WebSocket 接続を Sandbox 内の Gateway に中継（プロキシ）する際、URL クエリパラメータの `?token=xxx` を内部 Gateway への接続に引き継いでいなかった。結果、認証済みのはずのユーザーの接続が内部で「未認証」として扱われた

**対処：**

1. `npx wrangler secret list` で `MOLTBOT_GATEWAY_TOKEN` が設定済みか確認  
2. 設定済みなら、再デプロイ（`npm run deploy`）してコンテナを再起動  
3. それでも直らない場合は、トークンを再生成して再設定：

MOLTBOT\_GATEWAY\_TOKEN=$(openssl rand \-hex 32\)  
echo "新トークン: $MOLTBOT\_GATEWAY\_TOKEN"  
echo "$MOLTBOT\_GATEWAY\_TOKEN" | npx wrangler secret put MOLTBOT\_GATEWAY\_TOKEN  
npm run deploy

4. Control UI にアクセスする際は必ず `?token=新トークン` を URL に含める

**学び：** UI が表示される ≠ 内部の認証が通っている。UI の表示は静的ファイルの配信であり、チャット機能は WebSocket の認証が別途必要。

---

### **ケース2：ログを見ればだいたいわかる**

**症状：** 何が原因かわからない。エラーメッセージも表示されない。

**調べ方：**

**★ 最優先：AI にブラウザ操作させる**

CLI ツールでは CF Access にブロックされたり、コンテナ内部のエラーが見えなかったりする。**まずは AI にブラウザで直接確認させるのが最も効率的。**

\# Antigravity に出す指示の例  
「以下の URL をブラウザで順番に開いて、内容を教えて：  
 1\. https://worker.dev/?token=xxx（Control UI の状態確認）  
 2\. https://worker.dev/\_admin/（Admin UI のデバイス・プロセス状態確認）  
 3\. https://worker.dev/debug/processes（コンテナ内プロセス一覧）  
 4\. https://worker.dev/debug/logs?id=xxx（プロセスのログ）  
 5\. Cloudflare ダッシュボード → AI Gateway → ログタブ（LLM 呼び出し状況）  
 エラーがあれば原因と対処法を教えて。」

\# Claude Code の場合  
「Claude in Chrome で上記 URL を開いて確認して。」

AI がブラウザで CF Access 認証を通過し、ページ内容を読み取り、エラー原因を直接特定してくれる。以下の方法は AI のブラウザ操作が使えない場合の代替手段。

方法2：**`wrangler tail`（CLI のみで作業する場合）**

npx wrangler tail \--format pretty  
\# リアルタイムで Worker のログが流れる  
\# この状態で Control UI からメッセージを送って、ログを観察する  
\# Ctrl+C で終了

⚠️ ただし AI モデル呼び出しのエラーはコンテナ内部で処理されるため、`wrangler tail` に出ないことがある（ケース 0.5 参照）。WebSocket 接続やトークン認証の問題はここで確認できる。

方法3：**Cloudflare ダッシュボード**

1. Cloudflare ダッシュボードにログインする  
2. **左下のメニュー** →「Workers & Pages」→ 該当 Worker を選択  
3. **左メニューの「ログ」** を開く  
4. **ログに表示されている内容を全部コピー**する

方法4：**AI Gateway のログ**（LLM 呼び出し問題の場合はこれ）

1. 左メニュー →「コンピューティングと AI」→「AI Gateway」→ 該当 Gateway  
2. 「**ログ**」タブを開く  
3. リクエストのステータスコード・レスポンスを確認

**ログの送り先：** どの方法で取得したログでも、以下のいずれかに貼り付けて原因を聞く：

* Claude（claude.ai）に貼り付けて「このログからエラー原因を教えて」と聞く  
* OpenClaw の GitHub Issues で検索、または新規 Issue として貼り付ける  
* Discord コミュニティに貼り付けて質問する

**ログで見つかる典型的なエラーパターン：**

| ログに含まれるキーワード | 意味 | 対処 |
| ----- | ----- | ----- |
| `unauthorized` / `token_missing` | Gateway トークンが未設定または不一致 | `MOLTBOT_GATEWAY_TOKEN` を再設定して再デプロイ |
| `1008` | WebSocket 認証失敗（上記ケース1） | トークン再設定 \+ URL に `?token=` を含めてアクセス |
| `ANTHROPIC_API_KEY` / `API key` / `authentication` | LLM の API キーが未設定 or 無効 | `CLOUDFLARE_AI_GATEWAY_API_KEY` を確認。Gemini なら AI Studio、Claude なら Anthropic コンソールでキーを再発行して再設定 |
| `429` / `rate limit` | API レート制限超過 | Gemini：無料枠の制限リセットを待つ / Anthropic：残高確認 |
| `502` / `Bad Gateway` | 上流の AI プロバイダーが一時的に不通 | 数分待って再試行 |
| `EADDRINUSE` | ポート競合 | コンテナ再起動（再デプロイ） |
| `exit code 126` | Windows の改行コード問題（CRLF） | 上記「Windows 改行コード問題の対処」参照 |
| WebSocket 接続成功 \+ AI 応答が空（エラーなし） | モデル ID 不正 or AI Gateway 設定ミス | ケース 0.5 参照。`start-moltbot.sh` のモデル ID と AI Gateway のログを両方確認 |
| `providers` が `{}` / 設定 JSON に API キーがない | プロバイダー設定が空 | `/debug/container-config` で確認。`start-moltbot.sh` で providers が正しく生成されているか確認（ケース 0.5 の原因 2） |
| `Invalid config` / `baseUrl: Invalid input` | 設定 JSON のスキーマバリデーション失敗 | `baseUrl` が必須フィールド。直接 API でも `"baseUrl": "https://api.anthropic.com"` を明示指定する（ケース 0.5 の原因 3） |
| 応答が 300〜500ms で完了 | API コール未発生 | providers 空 / baseUrl 未指定 / モデル ID 不正のいずれか（ケース 5 の応答時間診断表参照） |
| デプロイ後も古い挙動が続く | コンテナプロセスが古い設定のまま稼働中 or R2 バックアップが上書き | Dockerfile のキャッシュバスト変更 \+ R2 の古いバックアップ削除 → 再デプロイ（ケース 4 参照） |

⚠️ **ログの見方がわからなくても、全部コピーして AI に聞けばよい。** 自分で読み解く必要はない。

---

### **ケース3（補足）：そもそもどこに API キーを入れるのが正しいのか**

**結論：Cloudflare ダッシュボードの左メニュー「コンピューティングと AI」→「AI Gateway」で Gateway を作り、そこにプロバイダーの API キーを登録する。** これが本マニュアルの標準手順（STEP 8）。

Worker のシークレットには Gateway の接続情報（ID・モデル名）だけを入れ、API キー自体は AI Gateway で管理する。

リクエストの流れ：  
OpenClaw → Cloudflare AI Gateway → Gemini / Claude 等の AI プロバイダー  
         （ここで API キー付与・コスト可視化・キャッシュ等が行われる）

\# Worker に入れるのはこの3つだけ  
npx wrangler secret put CLOUDFLARE\_AI\_GATEWAY\_ID          \# Gateway の ID  
npx wrangler secret put CLOUDFLARE\_AI\_GATEWAY\_API\_KEY     \# プロバイダーの API キー  
npx wrangler secret put CF\_AI\_GATEWAY\_MODEL               \# 使用するモデル名

AI Gateway を使うメリット：

* **コスト可視化**（ダッシュボードでトークン使用量・費用がリアルタイムで見える）  
* **モデル切替**（Gateway の設定変更だけで Gemini ↔ Claude を切り替え可能。再デプロイ不要）  
* **フォールバック**（プロバイダー障害時に別プロバイダーへ自動切替）  
* **キャッシュ・レート制限**（同じリクエストのキャッシュ、1分あたりのリクエスト数制限）

⚠️ **`ANTHROPIC_API_KEY` を Worker のシークレットに直接入れる方法もある（旧来の方法）が、本マニュアルでは AI Gateway 経由を標準とする。** 直接入れた場合はコスト可視化やモデル切替の機能が使えない。なお、AI Gateway 関連のシークレットと `ANTHROPIC_API_KEY` の両方が設定されている場合、AI Gateway が優先される。

---

### **ケース4：R2 バックアップが新しい設定を上書きする**

**症状：** 設定を修正してデプロイしたはずなのに、コンテナ再起動後に古い設定に戻っている。何度デプロイしても直らない。

**原因：** R2 ストレージに古い `clawdbot.json` がバックアップされている。コンテナ起動時に `start-moltbot.sh` が R2 からバックアップをリストアし、**デプロイで反映した新しい設定が古い設定で上書きされる。**

起動の流れ：  
1\. コンテナ起動  
2\. start-moltbot.sh が R2 バックアップからリストア ← 古い設定で上書き！  
3\. start-moltbot.sh の Node.js スクリプトが設定を再生成  
4\. (旧コンテナの場合) 再生成コードにも修正が反映されていない → 起動失敗  
5\. コンテナロールアウトで新イメージに切り替わる  
6\. 新コンテナの start-moltbot.sh で正しい設定が生成される → やっと動く

**対処：**

1. R2 バケット内の古いバックアップを削除する（Cloudflare ダッシュボード → R2 → 該当バケット → `clawdbot.json` を削除）  
2. Dockerfile のキャッシュバストを変更して再デプロイ  
3. 1〜2分待ってからコンテナが新しい設定で起動することを確認

**学び：**

* R2 バックアップは「データ永続化」のためにあるが、**古い壊れた設定も永続化してしまう**  
* デプロイ後は「旧コンテナが先に起動 → 新イメージに切り替わる」というロールアウト過程がある。旧コンテナの起動スクリプトは古いコードのまま  
* `start-moltbot.sh` と設定ファイルの **両方を同時に更新** すること

---

### **ケース5：デバッグで使えるエンドポイント・手法一覧**

問題が特定できないときに使えるデバッグ手段の一覧。`DEBUG_ROUTES=true` シークレットを設定すると有効になる。

echo "true" | npx wrangler secret put DEBUG\_ROUTES  
npm run deploy

**デバッグ用エンドポイント：**

| エンドポイント | 用途 | 確認できること |
| ----- | ----- | ----- |
| `/debug/container-config` | コンテナ内の設定 JSON を表示 | `providers` が空でないか、`baseUrl` が含まれているか、モデル ID が正しいか |
| `/debug/logs` | ゲートウェイの実行ログ | AI API 呼び出しのエラー、応答時間（300ms \= API 未到達） |
| `/debug/processes` | コンテナ内のプロセス一覧 | ゲートウェイプロセスが動いているか、古いプロセスが残っていないか |
| `/debug/cli?cmd=...` | コンテナ内で任意の CLI コマンド実行 | `clawdbot devices list`（ペアリング状態確認）等 |

⚠️ CF Access が有効な場合、これらのエンドポイントにも認証が必要（AI のブラウザ操作で確認するのが最も確実）。

**ブラウザの localStorage 確認（F12 → Console）：**

// デバイスペアリングの状態を確認  
JSON.stringify({  
  deviceIdentity: localStorage.getItem('clawdbot-device-identity-v1'),  
  deviceAuth: localStorage.getItem('clawdbot.device.auth.v1'),  
  settings: localStorage.getItem('clawdbot.control.settings.v1')  
})

ゲートウェイ再起動後に「Pairing required」が出る場合、これらの localStorage を削除してからトークン URL で再アクセスする。

**応答時間による診断早見表：**

| 応答時間 | 意味 | 原因の方向 |
| ----- | ----- | ----- |
| 300〜500ms | **API コール未発生** | providers 空 / baseUrl 未指定 / モデル ID 不正（ケース 0.5 の原因 1〜3） |
| 2〜5秒 | 正常な API 応答 | 問題なし |
| 10秒以上 | タイムアウト寸前 | API キー無効 / プロバイダー障害 / ネットワーク問題 |
| 即座にエラー | 設定バリデーション失敗 | `Invalid config` → ログにスキーマエラーが出ている |

⚠️ **デバッグ完了後は `DEBUG_ROUTES` を削除すること：**

npx wrangler secret delete DEBUG\_ROUTES

---

### **教訓まとめ（実際の 3 セッション・10 回以上のデプロイから）**

| 教訓 | 詳細 |
| ----- | ----- |
| API キーは設定 JSON に明示埋め込み | 環境変数からの自動読み取りを期待しない |
| `baseUrl` は省略不可 | 直接 API 利用でも `"baseUrl": "https://api.anthropic.com"` が必須 |
| 応答時間は最大の手がかり | 300ms で完了 \= API コールが発生していない |
| デプロイと起動スクリプトは同期する | 片方だけ更新すると R2 リストアで競合する |
| R2 バックアップは諸刃の剣 | 古い設定をリストアして新しい修正を上書きする可能性 |
| デバッグエンドポイントは必須 | コンテナ内部の状態を外から確認できる手段がないと詰む |
| localStorage のペアリング状態に注意 | ゲートウェイ再起動で無効化される → クリアして再ペアリング |

---

## **Antigravity / Claude Code に全工程を任せる場合のプロンプト**

### **セットアップ用プロンプト**

Agent Manager（Antigravity）または Claude Code に以下を貼り付ける：

このワークスペースは Moltworker（OpenClaw を Cloudflare Workers にデプロイするプロジェクト）です。  
以下の手順を順番に実行してください：

1\. npm install で依存パッケージをインストール  
2\. npx wrangler login で Cloudflare にログイン  
3\. 以下のシークレットを設定（値は都度聞いてください）:  
   \- CLOUDFLARE\_AI\_GATEWAY\_ID（AI Gateway の ID）  
   \- CLOUDFLARE\_AI\_GATEWAY\_API\_KEY（Gemini API キー。Claude に切り替える場合は Anthropic API キー）  
   \- CF\_AI\_GATEWAY\_MODEL（Gemini: google/gemini-3-flash / Claude: 未設定でデフォルト Sonnet 4.5）  
   \- MOLTBOT\_GATEWAY\_TOKEN（openssl rand \-hex 32 で生成して設定・値を表示）  
   \- CF\_ACCESS\_AUD  
   \- CF\_ACCESS\_TEAM\_DOMAIN  
   \- R2\_ACCESS\_KEY\_ID  
   \- R2\_SECRET\_ACCESS\_KEY  
   \- CF\_ACCOUNT\_ID  
4\. 全シークレット設定後に npm run deploy で再デプロイ  
5\. Worker URL にアクセスして動作確認

### **⚠️ トラブルシューティング用プロンプト（ブラウザ操作を指示する）**

デプロイ後にチャットが動かない場合、以下のプロンプトを貼り付ける。**AI にブラウザを操作させることで CF Access を通過し、問題を直接確認・解決させる。**

デプロイは完了したが、チャットのレスポンスが返ってこない。  
ブラウザを使って以下を順番に確認・対処してください：

【確認1：デバイスペアリング】  
ブラウザで https://worker-name.workers.dev/\_admin/ を開き、  
「Devices」セクションに未承認のペアリングリクエストがあれば全て Approve する。

【確認2：チャット動作テスト】  
ブラウザで https://worker-name.workers.dev/?token=ゲートウェイトークン を開き、  
チャットにメッセージを送信して、AI からの応答が返るか確認する。

【確認3：応答が空の場合】  
ブラウザで Cloudflare ダッシュボードを開き、  
AI Gateway → 該当 Gateway → 「ログ」タブを確認する。  
リクエストのステータスコードとエラー内容を教えて。

【確認4：モデル ID の確認】  
start-moltbot.sh 内のモデル ID を確認する。  
claude-opus-4-5-20251101 は存在しないモデル ID なので、  
claude-sonnet-4-5-20250929 に修正する。  
修正後は Dockerfile のキャッシュバストを変更して npm run deploy。

【確認5：デプロイ後の再確認】  
デプロイ完了後、1〜2分待ってからブラウザで再度チャットを送信し、  
応答が返ることを確認する。

⚠️ **ポイント：「ブラウザで開いて確認して」と明示的に指示する。** CLI コマンド（`curl` 等）だけでは CF Access にブロックされてデバッグできない。Antigravity は内蔵ブラウザ、Claude Code は Claude in Chrome でブラウザ操作を行う。

---

## **コスト一覧（常時稼働の場合）**

| サービス | 月額目安 |
| ----- | ----- |
| Workers Paid プラン | $5（必須） |
| Sandbox CPU | 〜$2–5 |
| Sandbox メモリ（4GiB） | 〜$12 |
| R2 | 無料枠内（10GB以下） |
| AI Gateway | 無料 |
| Access | 無料（50ユーザーまで） |
| **LLM API** | **下記参照** |
| **合計（Cloudflare側）** | **〜$19–22/月 \+ LLM API** |

### **LLM API コスト比較**

| プロバイダー | 月額目安 | 備考 |
| ----- | ----- | ----- |
| **① Gemini API（無料枠）** | **$0** | **← まずはこれ。** レート制限あり（1分15リクエスト等）。個人利用・軽量なら十分 |
| ② Anthropic API（Claude） | $20–100+/月 | 従量課金。高性能だが高コスト。必要になってから切り替える |
| Gemini API（従量課金） | 使用量次第 | Cloud Billing 有効化が必要。⚠️ 解約を忘れると自動課金される。基本的に不要 |

**最安構成：Cloudflare Workers Paid $5/月 \+ Gemini 無料枠 \= 月 $19–22 のみ（LLM 費用 $0）**

スリープ設定（`SANDBOX_SLEEP_AFTER=10m`）で Sandbox コストを削減可能。

---

## **シークレット一覧（設定するもの全て）**

| シークレット名 | 必須 | 取得元 |
| ----- | ----- | ----- |
| `CLOUDFLARE_AI_GATEWAY_ID` | **◎ 必須** | AI Gateway → Gateway 詳細 |
| `CLOUDFLARE_AI_GATEWAY_API_KEY` | **◎ 必須** | Gemini：Google AI Studio のキー / Claude：Anthropic API キー |
| `CF_AI_GATEWAY_MODEL` | **◎ 必須**（Gemini）/ △（Claude） | Gemini：`google/gemini-3-flash` / Claude：モデル変更時のみ |
| `MOLTBOT_GATEWAY_TOKEN` | ◎ 必須 | `openssl rand -hex 32` で自分で生成 |
| `CF_ACCOUNT_ID` | ◎ 必須 | ダッシュボード → …→ Copy Account ID |
| `CF_ACCESS_TEAM_DOMAIN` | ○推奨 | Zero Trust → Team ドメイン |
| `CF_ACCESS_AUD` | ○推奨 | Access → Application → AUD タグ |
| `R2_ACCESS_KEY_ID` | ○推奨 | R2 → API Tokens |
| `R2_SECRET_ACCESS_KEY` | ○推奨 | R2 → API Tokens |

※LLM は AI Gateway 経由で Gemini（推奨）または Claude を設定する。`ANTHROPIC_API_KEY` を直接設定する旧方式も動作するが、本マニュアルでは非推奨。

---

## **Gemini API 課金解約チェックリスト**

Gemini API を無料枠で使い続けるつもりなら、以下を定期的に確認する。Google は複数の経路で自動課金を追加してくるため、放置すると知らないうちに課金が始まる。

### **確認すべきこと（月1回推奨）**

1. **Google AI Studio（https://aistudio.google.com/apikey）**

   * 使用中の API キーが **「Free」** 表示であることを確認  
   * 「Tier 1」以上になっていたら課金プロジェクトに紐付いている → 新規プロジェクトでキーを再発行  
2. **GCP コンソール（https://console.cloud.google.com/billing）**

   * Gemini 用プロジェクトの課金が **「無効」** であることを確認  
   * 有効になっていたら →「課金を無効にする」を実行  
3. **Google One サブスクリプション（https://one.google.com/）**

   * Gemini Advanced / Google AI Pro の無料トライアルに登録していないか確認  
   * 登録していた場合：トライアル終了前に解約しないと **月額 ¥2,900 が自動課金** される  
   * 解約手順：Google One → メンバーシップ管理 →「定期購入を解約」  
4. **GCP 無料トライアル（$300 / 90日）**

   * 初回登録時に有効化した場合：90日経過 or $300 消費後に **標準課金に自動移行** する  
   * 不要なら GCP コンソール → 課金 → 該当アカウント → 課金を無効化

### **自動課金が発生する主なパターン**

| パターン | 発動条件 | 結果 |
| ----- | ----- | ----- |
| GCP プロジェクトに Cloud Billing を有効化 | API キー発行時に既存の課金プロジェクトを選択 | 無料枠超過分が自動請求 |
| GCP 無料トライアル終了 | 90日経過 or $300 使い切り | 標準従量課金に自動移行 |
| Gemini Advanced 無料トライアル終了 | 1〜2ヶ月の無料期間終了 | Google One プレミアム ¥2,900/月が自動課金 |
| 前払いクレジット残高枯渇 | チャージ分を使い切り | メインの支払い方法に自動請求 |

⚠️ いずれも「解約し忘れ」がトリガー。Googleカレンダーにリマインダーを設定することを強く推奨。

---

## **デバッグ用エンドポイント**

`DEBUG_ROUTES=true` シークレットで有効化。CF Access 認証が必要（AI のブラウザ操作で確認するのが最も確実）。

GET /debug/container-config  → コンテナ内の設定 JSON（providers・baseUrl・モデル ID を確認）  
GET /debug/processes         → コンテナ内プロセス一覧（古いプロセスの残存確認）  
GET /debug/logs?id=xxx       → 特定プロセスのログ（応答時間・API エラーを確認）  
GET /debug/cli?cmd=...       → コンテナ内で CLI コマンド実行（devices list 等）  
GET /debug/version           → コンテナ・OpenClaw バージョン情報

詳細な使い方・応答時間による診断方法は **ケーススタディ 5** を参照。

