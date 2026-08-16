import { HowlerAudioService } from '../../infrastructure/audio/howlerAudioService'
import { ScriptVM } from '#shared/domain/vm'
import type { ParsedScript } from '#shared/domain/types'

interface PortraitSlot {
  characterId: string
  imageDataUrl: string
}

export function usePlayback(script: ParsedScript) {
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

  const audio = new HowlerAudioService()

  const vm = new ScriptVM(script, {
    onDialogue(payload) {
      choices.value = null
      speakerName.value = payload.name
      speakerColor.value = payload.color
      text.value = payload.text

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

  function choose(target: string): void {
    vm.choose(target)
  }

  onUnmounted(() => audio.stopAll())

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
    start,
    advance,
    choose,
  }
}
