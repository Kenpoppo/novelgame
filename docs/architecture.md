# アーキテクチャ

vanilla TS版からの移行後の、正式なシステムアーキテクチャ。移行前の記録は
[legacy-vanilla-implementation.md](./legacy-vanilla-implementation.md) を参照。

## 全体像

「個人が作ったノベルゲームを、他のユーザーもプレイできる」ようにするため、
ブラウザだけで完結するローカルツールから、Nuxt(Vue) + Supabase による
Webサービスへ移行した。

```
ブラウザ(Nuxt/Vue, presentation層)
  ├─ /editor              … メイン画面(タイトル入力+プレイ/公開+7つの設定画面への入口タイル)
  │   ├─ /editor/characters … キャラクター設定(独立ページ)
  │   ├─ /editor/audio       … 音源(BGM/SE)設定(独立ページ)
  │   ├─ /editor/story       … ストーリー編集(独立ページ)
  │   ├─ /editor/branches    … ストーリー展開(選択肢・分岐)エディタ
  │   ├─ /editor/import      … 既存台本の読み込み(AI解析 or ヒューリスティック解析)
  │   ├─ /editor/profiles    … 人物設定(プロフィール)の一括読み込み
  │   └─ /editor/all         … 詳細設定(上記すべてを1画面にまとめた一覧)
  ├─ /play/local           … 編集中プロジェクトのローカルプレビュー
  ├─ /                     … 公開作品ギャラリー
  ├─ /play/[id]             … 公開作品をプレイ(誰でも・ログイン不要)
  ├─ /login                … 作者ログイン(公開する場合のみ必要)
  ├─ /start                … 初回セットアップ用オンボーディングウィザード
  └─ /confirm              … メール確認/OAuthコールバックの着地点
        │
        │ $fetch / useFetch
        ▼
Nitroサーバー(server/api/**、application層の薄いHTTPアダプタ)
        │
        ├─▶ Supabase(Postgres + Auth + Storage)
        └─▶ Anthropic API(台本のAI解析、ANTHROPIC_API_KEY設定時のみ)
```

`/editor` はキャラ/音源/ストーリー等の編集フォームを直接置かず、
7つの設定画面への入口(大きなタイル)だけを表示するシンプルなメイン画面に
している(`CharacterPanel`/`AudioPanel`/`StoryPanel` 等の各Vueコンポーネント
自体は変更せず、それぞれ専用ページ `/editor/characters` 等に1つだけ配置する
形)。どのページからでも同じ `useProjectStore()`(Pinia)を参照するため、
画面を移動してもデータは共有・自動保存される。

## レイヤー構成(Clean Architecture、簡略版)

```
shared/domain/        フレームワーク非依存の純粋TS。台本の型・パーサー・VM・
                       Project/Beatのデータモデル・compileProject・
                       scriptImport(台本解析結果をProject断片へ変換する
                       共通ロジック、AI/ヒューリスティック/自前DSLの3経路が
                       ここで合流する)・profileImport(【登場人物】セクションの
                       名前+人物設定ブロック抽出、mergeProfilesIntoCharacters
                       での台本キャラとの名寄せ)・heuristicAnalyzer(書式が
                       様々な台本テキストから話者・セリフを検出するルールベース
                       解析ライブラリ)。クライアント/サーバー両方から
                       #shared/domain/... で参照する(Nuxt 4 の shared/ 機能)。

application/           ユースケースとport(interface)。
  ports/                ProjectRepository / CloudProjectRepository /
                        AssetStorage / AuthProvider の interface のみ定義。
  useCases/              publishProject など、複数のportにまたがる
                        オーケストレーションが要るものだけ関数化する
                        (単純なCRUDの素通しはuseCaseを作らず、呼び出し側が
                        直接portを呼ぶ — 過剰な抽象化を避けるための意図的な判断)。

infrastructure/        portの実装(アダプタ)。application/ と同様、Nuxtの
                       `#application`/`#infrastructure` エイリアスは
                       サーバー側tsconfigに一部反映されない不具合があったため
                       使わず、相対importで参照する(詳細は decisions.md)。
  local/                 IndexedDbProjectRepository。ブラウザのみで完結する
                        ローカル編集用(クライアント専用)。
  supabase/               SupabaseCloudProjectRepository / SupabaseAssetStorage。
                        DBアクセスはサーバー側(Nitro)からのみ行う。
  audio/                  HowlerAudioService。BGM/SE再生(クライアント専用)。

app/                   Nuxtの規約に沿った presentation層(srcDir)。
  pages/                  ファイルベースルーティング。
                        editor/index.vue はメイン画面(タイルメニューのみ)、
                        editor/{characters,audio,story}.vue が各設定の
                        独立ページ、editor/branches.vue が選択肢・分岐
                        (ストーリー展開)エディタ、editor/import.vue が
                        台本読み込み、editor/profiles.vue が登場人物リスト
                        単体の読み込み、editor/all.vue が全設定を1画面に
                        まとめた詳細設定、start.vue が初回セットアップ用
                        オンボーディングウィザード(台本読み込み/登場人物
                        リスト読み込み/一から作る、の3ルート)。
  components/             editor/*.vue(CharacterPanel/AudioPanel/StoryPanel/
                        BackgroundPanel は各設定ページ・詳細設定ページの
                        両方から使い回すフォームUI、TtsPanelはTTS読み上げ
                        設定、SubPageHeaderは設定ページ共通の「← 戻る」
                        ヘッダー、PopLoadingはポップな全画面ローディング
                        表示、PreviewButtonは各設定ページ共通のプレビュー
                        導線、NoScriptDialogは台本が無い状態でプレイ/
                        プレビューしようとした時の案内モーダル、
                        BulkImageImportは複数画像のファイル名一致による
                        キャラ/背景への一括割り当て、WizardStepBarは
                        /start のステップ進行インジケータ)、
                        player/*.vue(ステージ・台詞・選択肢の表示、
                        CastListPanelはプレイ画面右上の登場人物リスト。
                        詳細は player.md)。
  composables/             usePlayback(domain(ScriptVM)・infrastructure
                        (Howler)をVueのreactivityに薄く繋ぐ)、
                        useScriptImportAnalysis(台本読み込み機能の解析
                        ロジック本体。editor/import.vue と start.vue の
                        両方から呼ぶ共通実装 — 詳細は script-import.md)、
                        useGoToPreview(プレイ/プレビュー導線の共通ガード。
                        台本が無ければNoScriptDialogを出す。4箇所の画面から
                        共通で呼ぶ)、useVoicevoxDetection(起動時に
                        VOICEVOXエンジンの `/speakers` を叩いて起動を検出。
                        TtsPanel/CharacterPanel で「ワンクリック有効化」
                        バナーを出すのに使う)。
  stores/(Pinia)          useProjectStore — 編集中Projectの状態と自動保存。
                        どのページからでも同じインスタンスを参照する。

server/api/**          Nitroルート。application層(または直接port経由で
                       infrastructure/supabase)を呼ぶだけの薄いHTTPアダプタ。
                       DBの権限制御はここではなくSupabaseのRLSに一元化する。
                       server/api/import/analyze.post.ts は例外的にportを
                       介さず直接 @anthropic-ai/sdk を呼ぶ(永続化を伴わない
                       ステートレスな解析処理のため)。

supabase/migrations/   テーブル定義・RLSポリシーのSQL。
```

権限ルール(「本人の作品しか編集できない/公開作品は誰でも見られる」)は
**RLS(DB側)を一次防御**とし、`server/api` 側でも `owner_id` の一致を
明示的にチェックする(二重チェック。UIやAPIルートそのものは信頼しない)。

## なぜローカル編集とクラウド公開を分けたか

- ローカル(IndexedDB)での下書き編集は、Supabaseアカウントが無くても
  今まで通り完結して使える(オフラインでも執筆できる)。
- 「公開する」ボタンを押した瞬間だけ、埋め込み画像/音源(data URL)を
  Supabase Storageへアップロードして実URLに差し替え、Postgresへ保存する
  (`application/useCases/publishProject.ts`)。
- これにより、Supabase未接続の状態でもアプリ全体が壊れず、公開機能だけが
  使えない状態になる(`nuxt.config.ts` でSupabase未設定時はプレースホルダー
  URLにフォールバックし、起動自体は失敗しない)。

## 技術スタック

| カテゴリ | 採用 |
|---|---|
| フロント / ビルド | Vue 3 + Nuxt 4(内部はVite) |
| 状態管理 | Pinia |
| ルーティング | Nuxtのファイルベースルーティング |
| シナリオ(ドメインモデル) | 自作(`Project`/`Beat`/`Instruction`)。ink等の外部narrative言語は不採用(GUI編集との相性を優先) |
| 音声 | Howler.js |
| UI | Tailwind CSS + カスタムCSS。「ポップ・任天堂ゲーム風」デザイン(丸ゴシック体+ビビッドな配色+立体的なボタン)。トークンは `app/assets/css/main.css`、フォントは Google Fonts「M PLUS Rounded 1c」 |
| バックエンド | Nuxt Nitroサーバールート |
| DB / 認証 / ストレージ | Supabase(Postgres, Auth, Storage) |
| AI(台本解析) | Anthropic API(`@anthropic-ai/sdk` + `zod`、モデル `claude-opus-5`)。未設定でもヒューリスティック解析にフォールバックする |
| 配信 | Cloudflare Pages(Nitroの`cloudflare-pages`プリセット) |

選定理由の詳細は [decisions.md](./decisions.md) を参照。

## セットアップ

- Supabase接続(公開機能を使う場合)の手順は [setup-supabase.md](./setup-supabase.md)。
- 台本のAI解析(任意)の手順は [script-import.md](./script-import.md)。

## 既知の制約(現時点)

- クラウドプロジェクトは1ユーザー1件の運用UIになっていない
  (`server/api/projects` は複数管理APIを持つが、エディタUIはローカルの
  単一下書きを公開する導線のみ)。
- ゲーム内セーブ(プレイ再開)のUIは未実装(`game_saves` テーブルのみ用意済み)。
- アニメーション演出(GSAP等)は未導入(フェード等のトランジションは
  CSSのみ)。
- 立ち絵は左右2スロット(発話中の側を明るく、非発話側を暗く)+ 画像A/B
  切り替え(表情・ポーズ違い)まで対応。細かい位置指定・複数キャラの
  同時演出等は未実装。背景は `BackgroundAsset` + `dialogue.backgroundId`
  でシーンごとに切り替え可能。
- 台本の自動読み込み(`/editor/import`)は台詞・地の文・キャラクター(および
  「登場人物」セクションからの人物設定)のみを検出し、選択肢や分岐は自動
  設定されない(読み込み後に `/editor/branches` で手動追加する)。
- メール確認/OAuthコールバック用の `/confirm` ページは最小限の実装
  (ログイン検知してエディタへ飛ばすのみ)。
