import { HowlerAudioService } from '../../infrastructure/audio/howlerAudioService'
import { VoicevoxTts } from '../../infrastructure/tts/voicevoxTts'
import { WebSpeechTts } from '../../infrastructure/tts/webspeechTts'
import type { TtsService } from '../../infrastructure/tts/ttsService'
import { ScriptVM } from '#shared/domain/vm'
import type { ParsedScript } from '#shared/domain/types'
import type { TtsConfig } from '#shared/domain/project/types'

interface PortraitSlot {
  characterId: string
  imageDataUrl: string
}

export function usePlayback(script: ParsedScript, ttsConfig?: TtsConfig) {
  const speakerName = ref<string | null>(null)
  const speakerColor = ref<string | undefined>(undefined)
  const text = ref('')
  const choices = ref<{ text: string; target: string }[] | null>(null)
  const ended = ref(false)
  // 対面表示のための左右スロット。しゃべっている側は activeSide で識別する。
  const leftSlot = ref<PortraitSlot | null>(null)
  const rightSlot = ref<PortraitSlot | null>(null)
  const activeSide = ref<'left' | 'right' | null>(null)
  const backgroundImage = ref<string | null>(null)

  // ポーズメニューから調整する音量/読み上げ速度。
  const bgmVolume = ref(0.7)
  const seVolume = ref(0.9)
  const ttsRateMultiplier = ref(1)

  const audio = new HowlerAudioService()
  audio.setBgmVolume(bgmVolume.value)
  audio.setSeVolume(seVolume.value)
  watch(bgmVolume, (v) => audio.setBgmVolume(v))
  watch(seVolume, (v) => audio.setSeVolume(v))

  // 発話中のボイスファイル(Audio)。次の発話で停止する。
  let voiceAudio: HTMLAudioElement | null = null

  const tts: TtsService | null = ttsConfig?.enabled
    ? ttsConfig.engine === 'voicevox'
      ? new VoicevoxTts(ttsConfig.voicevoxUrl ?? 'http://localhost:50021')
      : new WebSpeechTts()
    : null

  function stopVoice(): void {
    if (voiceAudio) {
      voiceAudio.pause()
      voiceAudio.currentTime = 0
      voiceAudio = null
    }
    tts?.stop()
  }

  const vm = new ScriptVM(script, {
    onDialogue(payload) {
      choices.value = null
      speakerName.value = payload.name
      speakerColor.value = payload.color
      text.value = payload.text

      // 発話再生: 既存ボイスファイル > TTS > 何もしない
      stopVoice()
      if (payload.voiceDataUrl) {
        const a = new Audio(payload.voiceDataUrl)
        voiceAudio = a
        void a.play().catch(() => {
          // 自動再生ブロック等は無視
        })
      } else if (tts) {
        const shouldSpeak = payload.characterId !== null || ttsConfig?.narrateNarration !== false
        if (shouldSpeak && payload.text.trim().length > 0) {
          const baseRate = payload.ttsRate ?? (payload.characterId === null ? ttsConfig?.narrationRate : undefined) ?? 1
          void tts.speak(payload.text, {
            voice: payload.ttsVoice ?? (payload.characterId === null ? ttsConfig?.narrationVoice : undefined),
            rate: baseRate * ttsRateMultiplier.value,
            pitch: payload.ttsPitch ?? (payload.characterId === null ? ttsConfig?.narrationPitch : undefined),
          })
        }
      }

      if (!payload.characterId || !payload.imageDataUrl) {
        // 地の文や画像未設定のキャラは、既存の立ち絵はそのままで話者だけ更新。
        activeSide.value = null
        return
      }

      const slotEntry: PortraitSlot = {
        characterId: payload.characterId,
        imageDataUrl: payload.imageDataUrl,
      }

      if (leftSlot.value?.characterId === payload.characterId) {
        leftSlot.value = slotEntry
        activeSide.value = 'left'
        return
      }
      if (rightSlot.value?.characterId === payload.characterId) {
        rightSlot.value = slotEntry
        activeSide.value = 'right'
        return
      }

      // 新しい話者は、直前にしゃべっていた側の反対に配置する
      // (どちらもいなければ左から)。
      const nextSide: 'left' | 'right' = activeSide.value === 'left' ? 'right' : 'left'
      if (nextSide === 'left') leftSlot.value = slotEntry
      else rightSlot.value = slotEntry
      activeSide.value = nextSide
    },
    onChoice(options) {
      choices.value = options
    },
    onBgm(src) {
      audio.playBgm(src)
    },
    onSe(src) {
      audio.playSe(src)
    },
    onBackground(src) {
      backgroundImage.value = src
    },
    onEnd() {
      choices.value = null
      speakerName.value = null
      leftSlot.value = null
      rightSlot.value = null
      activeSide.value = null
      text.value = '-- 終 --'
      ended.value = true
    },
  })

  function start(): void {
    vm.start()
  }

  function advance(): void {
    vm.advance()
  }

  function back(): void {
    // VMの履歴から前のdialogueに戻る。左右スロットや背景の状態は最新の
    // dialogueで自動的に再構築される(過去のdialogueがonDialogueを再送する)ため、
    // 明示的に復元する必要はない。
    vm.back()
  }

  function choose(target: string): void {
    vm.choose(target)
  }

  onUnmounted(() => {
    audio.stopAll()
    stopVoice()
  })

  return {
    speakerName,
    speakerColor,
    text,
    choices,
    ended,
    leftSlot,
    rightSlot,
    activeSide,
    backgroundImage,
    bgmVolume,
    seVolume,
    ttsRateMultiplier,
    start,
    advance,
    back,
    choose,
  }
}
