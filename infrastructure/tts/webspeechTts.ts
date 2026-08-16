import type { TtsOptions, TtsService, TtsVoice } from './ttsService'

/**
 * ブラウザ内蔵の Web Speech API(SpeechSynthesis)による読み上げ。
 * 追加インストール不要で動くのが利点。ただし利用できる日本語音声は
 * ブラウザ/OS 依存で、声質にはばらつきがある。
 */
export class WebSpeechTts implements TtsService {
  async speak(text: string, options: TtsOptions): Promise<void> {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'ja-JP'
    if (options.rate !== undefined) utterance.rate = clamp(options.rate, 0.1, 10)
    if (options.pitch !== undefined) utterance.pitch = clamp(options.pitch, 0, 2)

    const voices = speechSynthesis.getVoices()
    if (options.voice) {
      const matched = voices.find((v) => v.name === options.voice)
      if (matched) utterance.voice = matched
    }

    return new Promise((resolve) => {
      utterance.onend = () => resolve()
      utterance.onerror = () => resolve()
      speechSynthesis.speak(utterance)
    })
  }

  stop(): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    speechSynthesis.cancel()
  }

  async listVoices(): Promise<TtsVoice[]> {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return []
    let voices = speechSynthesis.getVoices()
    if (voices.length === 0) {
      // 一部ブラウザでは非同期にリストが読み込まれる
      await new Promise<void>((resolve) => {
        const handler = () => {
          speechSynthesis.removeEventListener('voiceschanged', handler)
          resolve()
        }
        speechSynthesis.addEventListener('voiceschanged', handler)
        setTimeout(resolve, 1000)
      })
      voices = speechSynthesis.getVoices()
    }
    return voices
      .filter((v) => v.lang.toLowerCase().startsWith('ja'))
      .map((v) => ({ id: v.name, name: v.name, language: v.lang }))
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
