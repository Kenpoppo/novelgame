import { HowlerAudioService } from '../../infrastructure/audio/howlerAudioService'
import { ScriptVM } from '#shared/domain/vm'
import type { ParsedScript } from '#shared/domain/types'

export function usePlayback(script: ParsedScript) {
  const speakerName = ref<string | null>(null)
  const speakerColor = ref<string | undefined>(undefined)
  const speakerImage = ref<string | undefined>(undefined)
  const text = ref('')
  const choices = ref<{ text: string; target: string }[] | null>(null)
  const ended = ref(false)

  const audio = new HowlerAudioService()

  const vm = new ScriptVM(script, {
    onDialogue(name, color, image, dialogueText) {
      choices.value = null
      speakerName.value = name
      speakerColor.value = color
      speakerImage.value = image
      text.value = dialogueText
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
    onEnd() {
      choices.value = null
      speakerName.value = null
      speakerImage.value = undefined
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

  return { speakerName, speakerColor, speakerImage, text, choices, ended, start, advance, choose }
}
