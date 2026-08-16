# プレイ画面(ノベルゲーム再生)

`/play/local`(エディタ内プレビュー、`app/pages/play/local.vue`)と
`/play/[id]`(公開作品、`app/pages/play/[id].vue`)はどちらも
`compileProject()` で `Project` → `ParsedScript` にコンパイルしてから、
共通の `StagePlayer.vue`(`app/components/player/`)に渡すだけの薄いラッパー。
再生ロジック自体は `app/composables/usePlayback.ts` が
`ScriptVM`(`shared/domain/vm.ts`)を Vue の reactivity に薄く繋いでいる。

## 画面構成(`StagePlayer.vue`)

- `TitleScreen.vue` — 開始前のタイトル画面(タイトル文字列+「はじめる」ボタン)。
- 立ち絵(`stage-cast`) — 左右2スロットの対面レイアウト。発話中の側が
  `stage-slot--active`、そうでない側は暗く落とす(`stage-slot--inactive`)。
- `DialogueBox.vue` — セリフ/ナレーションのテキストボックス。
- `ChoiceOverlay.vue` — 選択肢ボタン一覧(`beat.type === 'choice'`)。
- 左上: ホームボタン(🏠、`homeTo` prop の遷移先。プレビュー中は`/editor`、
  公開作品プレイ中は既定の`/`)、メニューボタン(☰、一時停止パネルを開く)。
- **右上: 登場人物リストボタン**(`CastListPanel.vue`、詳細は下記)。
- 左右端: 前後のセリフへ送る/戻すボタン(`stage-nav-button`)。
- 一時停止パネル(Escまたはメニューボタン) — BGM/SE音量スライダー、
  TTS読み上げ速度スライダー(`tts?.enabled` の時のみ)、
  「🔊 読み上げが終わったら自動で次へ進む」トグル(既定オフ、下記参照)、
  続ける/ホームへ戻る。

## 読み上げ終了で自動的に次へ進む(`autoAdvanceOnVoiceEnd`)

一時停止パネルのトグルをオンにすると、ボイス(アップロード済みボイス
ファイル、またはTTS)の再生が終わるたびに自動で次のセリフへ進む
(ハンズフリー再生)。ボイスファイルの`<audio>`イベント、
`TtsService.speak()`が返すPromiseのどちらにも対応している。

ボイスが全く再生されないビート(ボイスファイル無し・TTS無効・
ナレーションで読み上げ対象外等)では自動では進まず、従来通り手動で
進める必要がある(無音時間で自動的に進めるタイマー機能ではなく、
あくまで「ボイス再生の終了」をトリガーにした機能のため)。

キー操作: Space/Enter/→ で進む、← またはBackspaceで戻る、Escで一時停止。

## 登場人物リスト(`CastListPanel.vue`)

プレイ画面右上の👥ボタンを押すと、コンパイル済みスクリプトの
`script.characters`(`Record<string, CharacterDef>`)の全キャラクターを、
アイコン(`imageDataUrl`、未設定なら色付きのイニシャル)・名前(色付き)・
人物設定(`CharacterAsset.notes` → `CharacterDef.notes`)付きの一覧で表示する。

- 台本を最初から最後まで進めなくても、いつでも開いて確認できる
  (会話中に「この人誰だっけ」となるのを防ぐ狙い)。
- `notes` はエディタのキャラクター編集画面で入力したもの、または
  台本読み込み時に「登場人物」セクションから自動で取り込まれたものが
  そのまま表示される([script-import.md](./script-import.md)参照)。
- キャラクターが1人も居ない場合は「登場人物が登録されていません。」と表示する。

`CharacterDef`(`shared/domain/types.ts`)には元々 `notes` が定義されて
いなかったが、`compileProject()` は実際には `CharacterAsset`(notes込み)を
そのまま `characters` マップへ入れていたため、型定義に `notes?: string` を
追加してこのコンポーネントから安全に参照できるようにした。

## TTS(読み上げ)

`usePlayback.ts` が `tts.enabled` を見て、セリフ(`characterId`あり)は
そのキャラの `ttsVoice`/`ttsRate`/`ttsPitch`、ナレーション
(`characterId === null`)は `tts.narrationVoice`/`narrationRate`/
`narrationPitch` を使って読み上げる(`tts.narrateNarration` が true の時のみ
ナレーションも読み上げる)。設定側のUIは `TtsPanel.vue`/`CharacterPanel.vue`
を参照(`decisions.md` の関連エントリも参照)。
