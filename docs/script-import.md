# 台本の自動読み込み(AI解析)

`/editor/import`(メイン画面の「📥 台本を読み込む」タイル)から、既存の
台本テキストを貼り付ける/ファイルを選ぶと、キャラクターとセリフを自動で
検出し、プロジェクトに反映できる機能。

## 解析の優先順位

`analyze()`(`app/pages/editor/import.vue`)は3段階でフォールバックする。

1. **自前のテキストDSL**([script-format.md](./script-format.md))として
   `parseScript()` でパースを試みる。`@char` で登録されたキャラクターの
   発言が2件以上あれば、この結果をそのまま使う(最も高精度)。
2. **AI解析** — `POST /api/import/analyze` を呼ぶ。`ANTHROPIC_API_KEY` が
   設定されていれば Claude(`claude-opus-5`)に台本テキストを渡し、
   タイトル案・キャラクター(名前+配色案)・セリフ/地の文のビート列を
   構造化出力(`output_config.format` + Zodスキーマ、
   `@anthropic-ai/sdk/helpers/zod` の `zodOutputFormat()` +
   `client.messages.parse()`)として抽出する。
3. **ヒューリスティック解析** — AIが使えない(`ANTHROPIC_API_KEY` 未設定)、
   または失敗した場合、`analyzeScriptHeuristically()`
   (`shared/domain/project/heuristicAnalyzer.ts`、`scriptImport.ts`から
   再エクスポート)にフォールバックする。台本をアップロードする人ごとに
   書式がバラバラなため、複数パターンを優先順位付きで併用する:
   1. 名前だけの行 + 次の行が「セリフ」(または『セリフ』)の2行パターン
      (実際の台本で最も多い形式)。
   2. 同一行「名前: セリフ」「名前「セリフ」」。
   3. 名前の再掲がなく「セリフ」だけが連続する行は、直前の話者の続きとして
      扱う(空行を挟んだら引き継ぎをリセット)。
   4. 敬称・役職違いの表記ゆれ(「たかし」「たかし刑事」等)を名寄せして
      1人にまとめてから、台本全体で2回以上話者として出現する名前だけを
      正式なキャラクターとして採用する(頻度フィルタ)。
   実サンプル台本での検証結果や設計判断の詳細は
   [decisions.md](./decisions.md)を参照。

どの経路の結果も `ScriptAnalysis`(`title?`, `characters: {name, color?}[]`,
`beats: {speaker: string|null, text}[]`)という共通形式に正規化してから
`analysisToProjectFragments()` で新しいidを採番した `CharacterAsset[]` /
`Beat[]` に変換する(`shared/domain/project/scriptImport.ts`)。これにより
3つの解析経路が最終的に1つの変換ロジックへ合流する。

## 選択肢・分岐は対象外

抽出されるのは台詞・地の文・キャラクターのみ。選択肢(`choice`)やラベル/
ジャンプは自動生成しない — 台本の分岐構造を確実に読み取る保証がないため、
誤った分岐を自動生成するより、まず直線的な会話としてインポートし、
読み込み後にストーリー編集画面で手動追加する方針にしている。

## 反映後の遷移

「この内容を反映する」を押すと、`store.project` へ
`characters`/`beats` を追加(タイトルは検出できていれば上書き)した上で
`/editor/all`(詳細設定 — キャラクター/音源/ストーリーを1画面にまとめた
一覧)へ遷移する。分析できた内容をその場で確認・修正できるようにする狙い。
複数回インポートしても、キャラクターは名寄せせず常に新規追加になる
(同名キャラクターが重複する可能性がある。v1では許容している)。

## AI解析を有効にする

`.env` に `ANTHROPIC_API_KEY` を設定する(`.env.example` 参照)。未設定でも
アプリ全体は問題なく動作し、「台本を読み込む」機能もヒューリスティック解析で
使い続けられる — Supabase未接続時と同じ「機能単位でのグレースフルデグレード」
方針([decisions.md](./decisions.md)参照)。

## サーバー側の実装

`server/api/import/analyze.post.ts` が唯一 `application`/`infrastructure`
層のportを介さず直接 `@anthropic-ai/sdk` を呼ぶ例外的なルート
(DB永続化を伴わないステートレスな解析処理のため、port抽象化の恩恵が薄いと
判断した)。`ANTHROPIC_API_KEY` はサーバー側の環境変数としてのみ読み、
クライアントに渡さない。
