# 旧実装の記録(vanilla TS 版、アーカイブ)

> **2026-08-16 に Nuxt(Vue) + Supabase へ全面移行済み。現在のアーキテクチャは
> [architecture.md](./architecture.md) を参照。** このドキュメントは移行前
> (`src/` ディレクトリ構成だった頃)の実装記録であり、以後更新しない
> 過去のスナップショット。コード自体は移行時に置き換え済みで、
> ここに書かれているファイルパス(`src/engine/*` 等)は現在のリポジトリには
> 存在しない。移行の経緯は [decisions.md](./decisions.md) を参照。

## 概要

Web ブラウザ上で動くノベルゲームエンジン。Vite + TypeScript のみで構成し、
フレームワーク(React 等)には依存していない。

2つのエントリーポイントを持つ Vite マルチページ構成になっている。

```
index.html → src/main.ts  … エディタ(タイトル/キャラ/ストーリー/選択肢/
                              分岐/BGM・SEを作成するGUI)。既定の起動画面。
play.html  → src/play.ts  … プレイヤー(実際に遊ぶ画面)。エディタの
                              「プレイ」から遷移する。
```

作成〜再生の流れ:

```
エディタ(index.html)
  Project(タイトル/キャラ/ビート列/音源ライブラリ) を編集
        │ 自動保存(IndexedDB, src/editor/storage.ts)
        ▼
  「プレイ」→ compileProject() でバリデーション
        │ 成功
        ▼
  play.html を開く
        │ storage.getProject() → compileProject()
        ▼
  ParsedScript { instructions, labels, characters }
        │
        ▼
   ScriptVM (実行状態を持つ、DOM非依存)
        │  VMCallbacks (onDialogue / onChoice / onBgm / onSe / onEnd)
        ▼
   DomRenderer (DOM への描画・クリック/キー入力の受付・音声再生)
```

台本テキスト(`src/scripts/*.script.txt`)を直接書く経路(`parseScript()`)
も引き続き使える。これは主に上級者向け/エディタ初回起動時のシード生成用途。
データモデルの詳細は [editor.md](./editor.md)、テキスト形式の詳細は
[script-format.md](./script-format.md) を参照。

## ディレクトリ構成

```
src/
  engine/
    types.ts     命令(Instruction)・キャラクター定義の型
    labels.ts     ラベルマーカーの解決(parser.ts と editor/compile.ts で共用)
    parser.ts     台本テキスト → ParsedScript への変換
    vm.ts         ParsedScript を実行するステートマシン(DOM非依存)
    renderer.ts   VMCallbacks を実装し、DOM に描画・音声再生する
  editor/
    types.ts       Project/Beat/CharacterAsset/AudioCue の型
    storage.ts      IndexedDB への保存・読み込み
    compile.ts       Project → ParsedScript への変換とバリデーション
    sample-project.ts 初回起動時のシード(sample.script.txt から生成)
    editor.ts         エディタのエントリーポイント(状態管理・自動保存)
    characterPanel.ts キャラクター管理 UI
    audioPanel.ts      音源ライブラリ管理 UI
    storyPanel.ts      ストーリービート編集 UI
    editor.css         エディタ専用スタイル
  scripts/
    *.script.txt  台本ファイル本体(テキスト形式、シード生成に使用)
  main.ts         エディタを起動する(index.html)
  play.ts         プレイヤーを起動する(play.html)
  style.css       VN 風 UI のスタイル(プレイヤー用、共通の [hidden] ルール含む)
```

## モジュールの責務分離

- **parser.ts** — テキスト→データ構造の変換のみを行う。副作用なし。
- **vm.ts** — 「今どの命令を実行中か」という状態と、進行・分岐のルールを持つ。
  DOM や `document` に一切触れない。`VMCallbacks` インターフェース越しにしか
  外界とやり取りしない。
- **renderer.ts** — `VMCallbacks` を実装し、DOM の描画とユーザー入力(クリック/
  選択肢ボタン)を VM に伝える。

この分離により、将来的に以下のような変更がしやすくなっている。

- 描画方式を変える(Canvas/WebGL 化、モバイル向け UI 化など)場合、
  `renderer.ts` を差し替えるだけで済み、`vm.ts`/`parser.ts` は無傷。
- VM 単体のユニットテスト・自動プレイテストが DOM なしで書ける。
- セーブ/ロード機能は VM の状態(現在のポインタ位置)をシリアライズすれば
  実現できる見込み(未実装)。

## 状態管理のポイント

- 「現在どの命令を指しているか(pointer)」は `ScriptVM` だけが持つ唯一の
  真実(single source of truth)。レンダラー側は自身では進行状態を判断せず、
  クリックやキー入力をそのまま `vm.advance()` / `vm.choose(target)` に委譲する。
- 選択肢表示中にクリックやキー入力で誤って読み飛ばされないよう、
  `advance()` は現在の命令が `choice` の場合は何もしない(`vm.ts` 内でガード)。
  レンダラー側に同様の判定を重複させない設計。

## 既知の制約(vanilla TS版 当時)

- 立ち絵・背景画像の本格的な演出(位置指定・切り替え等)は未実装。
  発言キャラクターの小さなアバター表示のみ対応(`renderer.ts` の `onDialogue`)。
- ゲーム進行のセーブ/ロード(プレイ途中からの再開)は未実装
  (エディタの内容自体は IndexedDB に自動保存されるが、これは「作成中の
  プロジェクト」の保存であり、プレイ中のセーブポイントとは別)。
- エディタは単一プロジェクトのみ(複数ストーリーの切り替え・管理は未実装)。

これらの制約のうち、Nuxt+Supabase移行後も引き続き残っているものは
[architecture.md](./architecture.md)「既知の制約」に記載している。
以後の変更・意思決定は [decisions.md](./decisions.md) に追記していく
(本ファイル自体はアーカイブのため更新しない)。
