<script setup lang="ts">
import type { ParsedScript } from '#shared/domain/types'
import type { TtsConfig } from '#shared/domain/project/types'
import type { VMSaveState } from '#shared/domain/vm'

const props = defineProps<{
  title: string
  script: ParsedScript
  tts?: TtsConfig
  // ホームボタン押下時の遷移先。プレビュー中(/play/local)は /editor に戻すため。
  homeTo?: string
  // localStorage に保存する再開位置のキー。プロジェクト/公開作品ごとに一意に指定する。
  // 省略時は保存/再開機能を無効化する。
  saveKey?: string
}>()

const SAVE_KEY_PREFIX = 'novelgame:play-save:'
const savedState = ref<VMSaveState | null>(null)

function readSave(): VMSaveState | null {
  if (!props.saveKey || typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(SAVE_KEY_PREFIX + props.saveKey)
    if (!raw) return null
    const parsed = JSON.parse(raw) as VMSaveState
    if (typeof parsed?.pointer !== 'number' || !Array.isArray(parsed.history)) return null
    return parsed
  } catch {
    return null
  }
}

function writeSave(state: VMSaveState): void {
  if (!props.saveKey || typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(SAVE_KEY_PREFIX + props.saveKey, JSON.stringify(state))
  } catch {
    // 容量超過など。ここでは黙って諦める(次回はセーブなしで最初から始まるだけ)。
  }
}

function clearSave(): void {
  if (!props.saveKey || typeof localStorage === 'undefined') return
  try {
    localStorage.removeItem(SAVE_KEY_PREFIX + props.saveKey)
  } catch {
    // ignore
  }
}

const started = ref(false)
const paused = ref(false)
const playback = usePlayback(props.script, props.tts, {
  onProgress(state) {
    // dialogueへ進むたびに現在位置を記録する。
    savedState.value = state
    writeSave(state)
  },
})
const router = useRouter()

// 初期表示時に既存のセーブを読み込む(タイトル画面の「続きから」ボタンの出し分けに使う)。
onMounted(() => {
  savedState.value = readSave()
})

function handleStart(): void {
  // 「最初から」を押されたら過去のセーブは破棄する。
  clearSave()
  savedState.value = null
  started.value = true
  playback.start()
}

function handleResume(): void {
  const state = savedState.value
  if (!state) {
    handleStart()
    return
  }
  started.value = true
  const ok = playback.resume(state)
  if (!ok) {
    // スクリプトが変わって範囲外になった等。セーブを捨てて最初から始め直す。
    clearSave()
    savedState.value = null
    playback.start()
  }
}

function togglePause(): void {
  paused.value = !paused.value
}

function goHome(): void {
  router.push(props.homeTo ?? '/')
}

// ゲーム終了時は再開する場所がないのでセーブを消しておく。
watch(() => playback.ended.value, (isEnded) => {
  if (isEnded) {
    clearSave()
    savedState.value = null
  }
})

function handleKeydown(event: KeyboardEvent): void {
  if (!started.value) return
  if (event.code === 'Escape') {
    togglePause()
    return
  }
  if (paused.value) return
  if (event.code === 'Space' || event.code === 'Enter' || event.code === 'ArrowRight') {
    playback.advance()
    return
  }
  if (event.code === 'ArrowLeft' || event.code === 'Backspace') {
    playback.back()
  }
}

onMounted(() => window.addEventListener('keydown', handleKeydown))
onUnmounted(() => window.removeEventListener('keydown', handleKeydown))
</script>

<template>
  <TitleScreen v-if="!started" :title="title" :has-save="!!savedState" @start="handleStart" @resume="handleResume" />
  <div
    v-else
    class="stage"
    :style="playback.backgroundImage.value ? { backgroundImage: `url(${playback.backgroundImage.value})` } : {}"
    :class="{ 'stage--has-bg': !!playback.backgroundImage.value }"
  >
    <NuxtLink :to="homeTo ?? '/'" class="stage-home-button" aria-label="ホームへ戻る" title="ホームへ戻る">
      🏠
    </NuxtLink>
    <button
      type="button"
      class="stage-menu-button"
      aria-label="メニュー(Esc)"
      title="メニュー(Esc)"
      @click="togglePause"
    >☰</button>
    <CastListPanel :characters="Object.values(script.characters)" />
    <button
      type="button"
      class="stage-nav-button stage-nav-button--prev"
      aria-label="1つ前のセリフへ"
      title="1つ前のセリフへ"
      @click="playback.back"
    >‹</button>
    <button
      type="button"
      class="stage-nav-button stage-nav-button--next"
      aria-label="次のセリフへ"
      title="次のセリフへ"
      @click="playback.advance"
    >›</button>

    <div class="stage-cast">
      <div
        class="stage-slot stage-slot--left"
        :class="{ 'stage-slot--active': playback.activeSide.value === 'left', 'stage-slot--inactive': playback.activeSide.value === 'right' }"
      >
        <img
          v-if="playback.leftSlot.value"
          :key="playback.leftSlot.value.imageDataUrl"
          class="stage-portrait-image"
          :src="playback.leftSlot.value.imageDataUrl"
          alt=""
        >
      </div>
      <div
        class="stage-slot stage-slot--right"
        :class="{ 'stage-slot--active': playback.activeSide.value === 'right', 'stage-slot--inactive': playback.activeSide.value === 'left' }"
      >
        <img
          v-if="playback.rightSlot.value"
          :key="playback.rightSlot.value.imageDataUrl"
          class="stage-portrait-image stage-portrait-image--flipped"
          :src="playback.rightSlot.value.imageDataUrl"
          alt=""
        >
      </div>
    </div>
    <ChoiceOverlay v-if="playback.choices.value" :options="playback.choices.value" @choose="playback.choose" />
    <DialogueBox
      :speaker-name="playback.speakerName.value"
      :speaker-color="playback.speakerColor.value"
      :text="playback.text.value"
      @advance="playback.advance"
    />

    <div v-if="paused" class="stage-pause-overlay" @click.self="togglePause">
      <div class="stage-pause-panel">
        <h2>一時停止</h2>

        <div class="stage-pause-sliders">
          <label class="stage-pause-slider">
            <span>BGM 音量</span>
            <input v-model.number="playback.bgmVolume.value" type="range" min="0" max="1" step="0.05">
            <span class="stage-pause-slider-value">{{ Math.round(playback.bgmVolume.value * 100) }}%</span>
          </label>
          <label class="stage-pause-slider">
            <span>SE 音量</span>
            <input v-model.number="playback.seVolume.value" type="range" min="0" max="1" step="0.05">
            <span class="stage-pause-slider-value">{{ Math.round(playback.seVolume.value * 100) }}%</span>
          </label>
          <label class="stage-pause-slider">
            <span>再生速度</span>
            <input v-model.number="playback.playbackSpeed.value" type="range" min="0.5" max="2" step="0.1">
            <span class="stage-pause-slider-value">{{ playback.playbackSpeed.value.toFixed(1) }}x</span>
          </label>
        </div>

        <div class="stage-pause-speed-presets" role="group" aria-label="再生速度プリセット">
          <button
            v-for="preset in [1, 1.5, 2]"
            :key="preset"
            type="button"
            class="stage-pause-speed-preset"
            :class="{ 'stage-pause-speed-preset--active': playback.playbackSpeed.value === preset }"
            @click="playback.playbackSpeed.value = preset"
          >{{ preset.toFixed(1) }}x</button>
        </div>

        <label class="stage-pause-toggle">
          <input v-model="playback.autoAdvanceOnVoiceEnd.value" type="checkbox">
          <span>🔊 読み上げが終わったら自動で次へ進む</span>
        </label>

        <button type="button" class="publish-button" @click="togglePause">続ける (Esc)</button>
        <button type="button" class="io-button" @click="goHome">
          {{ homeTo === '/editor' ? '編集画面へ戻る' : 'ホーム(ギャラリー)へ戻る' }}
        </button>
        <p class="stage-pause-hint">
          Space/→: 進む &nbsp; ←: 戻る &nbsp; Esc: メニュー
        </p>
      </div>
    </div>
  </div>
</template>
