# エディタのデータモデル

ブラウザGUIエディタ(`/editor`)が扱うデータ構造・保存方法・
再生用データへの変換ルールをまとめる。全体構成は
[architecture.md](./architecture.md) を参照。

## データモデル(`shared/domain/project/types.ts`)

```ts
interface Project {
  title: string
  characters: CharacterAsset[]
  audio: AudioCue[]
  backgrounds: BackgroundAsset[]
  beats: Beat[]
}

interface BackgroundAsset {
  id: string
  label: string             // 例:「事務所・昼」「ラジオ局」
  imageDataUrl?: string      // 背景画像(任意)
}

interface CharacterAsset {
  id: string
  name: string
  color?: string
  imageDataUrl?: string    // アップロード画像A(任意、既定の立ち絵)
  imageAltDataUrl?: string // 画像B(任意、状況に応じて切り替える別ポーズ/表情)
  voiceDataUrl?: string    // サンプル/テーマ音声(任意、CharacterPanelから試聴可)
  notes?: string           // 人物設定・口調・背景などのフリーテキスト(任意)
}

interface AudioCue {
  id: string
  kind: 'bgm' | 'se'
  label: string          // 例:「教室・日常」
  fileDataUrl?: string    // 実ファイル(任意、後から追加可)
  sourceNote?: string     // 参照メモ
}

type Beat =
  | { id: string; type: 'dialogue'; characterId: string | null; text: string; useAltImage?: boolean }
  | { id: string; type: 'label'; name: string }
  | { id: string; type: 'jump'; target: string }
  | { id: string; type: 'choice'; options: { text: string; target: string }[] }
  | { id: string; type: 'bgm'; audioId: string | null } // null = 停止
  | { id: string; type: 'se'; audioId: string }
  | { id: string; type: 'background'; backgroundId: string | null } // null = 既定/背景なし
```

`Project` はキャラクター画像・音源ファイルの data URL を含めて自己完結
させている(他プロジェクトへの参照を持たない)。`beats` の並び順がそのまま
ストーリーの進行順になる。`label`/`choice`/`jump` の関係はテキスト台本形式
(`docs/script-format.md`)の `*label`/`?`/`->` と同じ考え方。

## 保存(`infrastructure/local/indexedDbProjectRepository.ts`)

`localStorage` はキャラ画像・音声の data URL を入れるとすぐ 5MB 制限に
当たるため使わず、**IndexedDB**(DB名 `novelgame`)に保存する。
`application/ports/projectRepository.ts` の `ProjectRepository` interface の
ローカル実装で、`app/stores/project.ts`(Pinia)から使われる。

- `project` ストア — 固定キー `"current"` に `Project` を1件保存
  (ローカルは単一プロジェクトのみ。クラウド側の複数プロジェクト管理は
  `application/ports/cloudProjectRepository.ts` が別に持つ)。
- `characterLibrary` ストア(`keyPath: 'id'`) — プロジェクトをまたいで
  再利用できるキャラクターの保管庫。「新規作成」時に「ライブラリにも保存」
  にチェックを入れると登録され、以後どのプロジェクトからも
  「ライブラリから追加」で呼び出せる(呼び出し時は `id` を振り直した
  コピーとしてプロジェクトに追加され、プロジェクト側の編集はライブラリの
  元データに影響しない)。

`app/stores/project.ts` は `project` state を `watch(..., {deep:true})` して
おり、変更のたびに自動保存する(明示的な保存ボタンはない)。保存前に
`JSON.parse(JSON.stringify(...))` でVueのreactive Proxyをプレーンオブジェクト
へ変換している(Proxyのまま`IDBObjectStore.put()`に渡すと`DataCloneError`に
なるため。詳細は[decisions.md](./decisions.md))。

## 再生用データへの変換(`shared/domain/project/compile.ts`)

`compileProject(project)` が `Project` を既存エンジンの `ParsedScript`
(`shared/domain/types.ts`)へ変換する。ロジックはテキスト台本パーサー
(`shared/domain/parser.ts`)と同じ `resolveLabels()`(`shared/domain/labels.ts`)
を共用しており、`label` ビートを取り除きながら `labels` マップを作る。

バリデーション(エラーがあれば `CompileResult.ok = false` で理由の配列を返し、
プレイへは進ませない):

- ラベル名の重複
- `jump`/`choice` の飛び先ラベルが存在しない
- `dialogue` の `characterId` がプロジェクトのキャラクターに存在しない
- `bgm`/`se` ビートが参照している `audioId` が音源ライブラリに存在しない

一方、**音源に実ファイル(`fileDataUrl`)が無くてもエラーにはしない**。
その場合はコンパイル結果からその `bgm`/`se` 命令自体を除外する(＝再生時に
黙ってスキップされる)。これにより、実際の音源ファイルを用意する前でも
ストーリーの執筆・分岐確認を進められる。

## 再生

- ローカルプレビュー(`app/pages/play/local.vue`) — 編集中のプロジェクトを
  `store.load()` → `compileProject()` した上でそのままプレイする。
- 公開作品(`app/pages/play/[id].vue`) — `server/api/games/[id].get.ts`
  から `Project` を取得して同様に再生する。
- どちらも `StagePlayer.vue`(→`usePlayback.ts`)が `ScriptVM` を実行し、
  `TitleScreen.vue`/`DialogueBox.vue`/`ChoiceOverlay.vue` に描画を委譲する。
  `shared/domain/vm.ts` は presentation層の実装を選ばない。

## 公開(`application/useCases/publishProject.ts`)

エディタの「公開する」ボタン(要ログイン)は `POST /api/projects/publish`
を叩き、サーバー側で以下を行う:

1. `compileProject()` によるバリデーション(失敗すればここで止まる)。
2. `Project` に埋め込まれた data URL(キャラ画像・音源)を
   `AssetStorage`(Supabase Storage実装)で実ファイルへアップロードし、
   URLに差し替える。
3. `CloudProjectRepository.save()` で保存し、`setPublished(true)`。

ローカルの下書きはこのタイミングまで他ユーザーから見えない。詳細な
セットアップは [setup-supabase.md](./setup-supabase.md)。

## 初回シード

保存済みプロジェクトが無いとき(初回のローカル利用時)は、
`createEmptyProject()`(`shared/domain/project/types.ts`)で生成した
空のプロジェクト(タイトル「無題のストーリー」、キャラ/音源/ビートすべて空)
をエディタに読み込ませる。以前は taro/hana のサンプル台本をシードしていたが、
初期表示にサンプルのタイトルやセリフが混じるのを避けたいため、
空のエディタで開始する方針に変更した(詳細は [decisions.md](./decisions.md))。
