export interface CharacterAsset {
  id: string
  name: string
  color?: string
  imageDataUrl?: string
  // 状況に応じて切り替える2枚目の立ち絵(表情/ポーズ違いなど)。
  imageAltDataUrl?: string
  // 各キャラクターに紐づく1つのサンプル/テーマ音声(data URL or storage URL)。
  voiceDataUrl?: string
  // TTS(読み上げ)用のボイス識別子:
  //   - Web Speech の場合は voice の name
  //   - VOICEVOX の場合は speaker(style) id を文字列化したもの
  ttsVoice?: string
  ttsRate?: number
  ttsPitch?: number
  // 人物設定(一人称・口調・背景など)のフリーテキスト。編集画面での参考用。
  notes?: string
}

export interface AudioCue {
  id: string
  kind: 'bgm' | 'se'
  label: string
  fileDataUrl?: string
  sourceNote?: string
}

export interface BackgroundAsset {
  id: string
  label: string
  imageDataUrl?: string
}

export interface TtsConfig {
  enabled: boolean
  engine: 'webspeech' | 'voicevox'
  voicevoxUrl?: string
  narrateNarration?: boolean
  narrationVoice?: string
  narrationRate?: number
  narrationPitch?: number
}

/**
 * エディタ上でのみ存在する「ビート」。label は再生用データへコンパイルする際に
 * resolveLabels() で取り除かれ、labels マップへ解決される。
 */
export type Beat =
  | {
      id: string
      type: 'dialogue'
      characterId: string | null
      text: string
      useAltImage?: boolean
      /**
       * このセリフを再生する直前に切り替えたい背景。
       * - undefined: 変更しない(前のシーンの背景を継承)
       * - null: 背景なし(既定のグラデーションに戻す)
       * - string: 背景ライブラリのID
       */
      backgroundId?: string | null
    }
  | { id: string; type: 'label'; name: string }
  | { id: string; type: 'jump'; target: string }
  | { id: string; type: 'choice'; options: { text: string; target: string }[] }
  | { id: string; type: 'bgm'; audioId: string | null }
  | { id: string; type: 'se'; audioId: string }
  | { id: string; type: 'background'; backgroundId: string | null }

export interface Project {
  title: string
  characters: CharacterAsset[]
  audio: AudioCue[]
  backgrounds: BackgroundAsset[]
  beats: Beat[]
  tts?: TtsConfig
}

export function createId(): string {
  return crypto.randomUUID()
}

export function createEmptyProject(title = '無題のストーリー'): Project {
  return { title, characters: [], audio: [], backgrounds: [], beats: [] }
}
