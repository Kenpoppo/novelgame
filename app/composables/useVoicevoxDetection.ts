import { VoicevoxTts } from '../../infrastructure/tts/voicevoxTts'
import type { TtsVoice } from '../../infrastructure/tts/ttsService'

const DEFAULT_VOICEVOX_URL = 'http://localhost:50021'

/**
 * VOICEVOX(ローカルで起動するTTSエンジン)が起動しているかを検出する。
 *
 * プロジェクトの `tts.enabled` を有効にしなくても、VOICEVOXが起動していれば
 * すぐ話者一覧が見えるようにしたい(「VOICEVOXが起動している場合は話者を
 * 選べるようにしたい」という要望への対応)。TtsPanel(TTS設定画面)と
 * CharacterPanel(話者選択UI)の両方から使う。
 */
export function useVoicevoxDetection() {
  // null: 未チェック, true: 起動確認できた, false: 未起動/接続不可
  const available = ref<boolean | null>(null)
  const checking = ref(false)
  const speakers = ref<TtsVoice[]>([])

  async function check(url: string = DEFAULT_VOICEVOX_URL): Promise<void> {
    checking.value = true
    try {
      const voices = await new VoicevoxTts(url || DEFAULT_VOICEVOX_URL).listVoices()
      speakers.value = voices
      available.value = voices.length > 0
    } finally {
      checking.value = false
    }
  }

  return { available, checking, speakers, check }
}
