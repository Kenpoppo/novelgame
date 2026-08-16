import type { TtsOptions, TtsService, TtsVoice } from './ttsService'

/**
 * VOICEVOX (localhost:50021 の HTTP API)を使った読み上げ。
 * ユーザーが VOICEVOX/Coeiroink/AivisSpeech いずれかを起動しておく必要がある。
 * ずんだもん・四国めたん等のキャラ声で高品質な日本語 TTS が可能。
 */
export class VoicevoxTts implements TtsService {
  private currentAudio: HTMLAudioElement | null = null

  constructor(private readonly baseUrl: string) {}

  async speak(text: string, options: TtsOptions): Promise<void> {
    if (!text.trim()) return
    this.stop()

    const speaker = options.voice ?? '3'
    try {
      // 1) 韻律・アクセント情報を計算
      const queryUrl = `${this.baseUrl}/audio_query?speaker=${encodeURIComponent(speaker)}&text=${encodeURIComponent(text)}`
      const queryRes = await fetch(queryUrl, { method: 'POST' })
      if (!queryRes.ok) return
      const query = await queryRes.json()

      if (options.rate !== undefined) query.speedScale = options.rate
      if (options.pitch !== undefined) query.pitchScale = options.pitch - 1

      // 2) 音声合成
      const synthRes = await fetch(`${this.baseUrl}/synthesis?speaker=${encodeURIComponent(speaker)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(query),
      })
      if (!synthRes.ok) return
      const wavBlob = await synthRes.blob()
      const url = URL.createObjectURL(wavBlob)

      // 3) 再生
      await new Promise<void>((resolve) => {
        const audio = new Audio(url)
        this.currentAudio = audio
        audio.addEventListener('ended', () => {
          URL.revokeObjectURL(url)
          if (this.currentAudio === audio) this.currentAudio = null
          resolve()
        })
        audio.addEventListener('error', () => {
          URL.revokeObjectURL(url)
          resolve()
        })
        void audio.play().catch(() => resolve())
      })
    } catch {
      // 未起動などのエラーは黙って握りつぶす(ゲーム進行は止めない)
    }
  }

  stop(): void {
    if (this.currentAudio) {
      this.currentAudio.pause()
      this.currentAudio.currentTime = 0
      this.currentAudio = null
    }
  }

  async listVoices(): Promise<TtsVoice[]> {
    try {
      const res = await fetch(`${this.baseUrl}/speakers`)
      if (!res.ok) return []
      const speakers: Array<{ name: string; styles: Array<{ id: number; name: string }> }> = await res.json()
      return speakers.flatMap((s) =>
        s.styles.map((style) => ({
          id: String(style.id),
          name: `${s.name}（${style.name}）`,
        })),
      )
    } catch {
      return []
    }
  }
}
