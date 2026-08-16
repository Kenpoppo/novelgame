import { Howl } from 'howler'

/**
 * BGM/SE再生を Howler.js でラップする。クロスブラウザのオートプレイ制限対応・
 * 複数SEの同時再生・フェードを自前実装せずに扱える。
 */
export class HowlerAudioService {
  private bgm: Howl | null = null

  playBgm(src: string | null): void {
    this.bgm?.stop()
    this.bgm?.unload()
    this.bgm = null

    if (!src) return

    this.bgm = new Howl({ src: [src], loop: true, volume: 0.7 })
    this.bgm.play()
  }

  playSe(src: string): void {
    const se = new Howl({ src: [src], volume: 0.9 })
    se.play()
  }

  stopAll(): void {
    this.bgm?.stop()
    this.bgm?.unload()
    this.bgm = null
  }
}
