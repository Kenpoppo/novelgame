/**
 * TTS(Text-to-Speech)の共通インターフェース。
 * ブラウザ内蔵の Web Speech API と、ローカルで動かす VOICEVOX の2つを
 * 同じ API で扱えるようにする。
 */
export interface TtsOptions {
  voice?: string
  rate?: number
  pitch?: number
}

export interface TtsVoice {
  id: string
  name: string
  language?: string
}

export interface TtsService {
  speak(text: string, options: TtsOptions): Promise<void>
  stop(): void
  listVoices(): Promise<TtsVoice[]>
}
