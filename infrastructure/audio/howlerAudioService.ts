import { Howl } from 'howler'

/**
 * BGM/SE再生を Howler.js でラップする。クロスブラウザのオートプレイ制限対応・
 * 複数SEの同時再生・フェードを自前実装せずに扱える。
 * BGM と SE の音量はそれぞれ独立に調整でき、実行中の Howl にも即座に反映される。
 */
export class HowlerAudioService {
  private bgm: Howl | null = null
  private bgmVolume = 0.7
  private seVolume = 0.9

  playBgm(src: string | null): void {
    this.bgm?.stop()
    this.bgm?.unload()
    this.bgm = null

    if (!src) return

    this.bgm = new Howl({ src: [src], loop: true, volume: this.bgmVolume })
    this.bgm.play()
  }

  playSe(src: string): void {
    const se = new Howl({ src: [src], volume: this.seVolume })
    se.play()
  }

  setBgmVolume(value: number): void {
    this.bgmVolume = Math.min(Math.max(value, 0), 1)
    this.bgm?.volume(this.bgmVolume)
  }

  setSeVolume(value: number): void {
    this.seVolume = Math.min(Math.max(value, 0), 1)
  }

  stopAll(): void {
    this.bgm?.stop()
    this.bgm?.unload()
    this.bgm = null
  }
}
