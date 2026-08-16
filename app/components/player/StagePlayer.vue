<script setup lang="ts">
import type { ParsedScript } from '#shared/domain/types'
import type { TtsConfig } from '#shared/domain/project/types'

const props = defineProps<{
  title: string
  script: ParsedScript
  tts?: TtsConfig
  // ホームボタン押下時の遷移先。プレビュー中(/play/local)は /editor に戻すため。
  homeTo?: string
}>()

const started = ref(false)
const paused = ref(false)
const playback = usePlayback(props.script, props.tts)
const router = useRouter()

function handleStart(): void {
  started.value = true
  playback.start()
}

function togglePause(): void {
  paused.value = !paused.value
}

function goHome(): void {
  router.push(props.homeTo ?? '/')
}

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
  <TitleScreen v-if="!started" :title="title" @start="handleStart" />
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
          <label v-if="tts?.enabled" class="stage-pause-slider">
            <span>読み上げ速度</span>
            <input v-model.number="playback.ttsRateMultiplier.value" type="range" min="0.5" max="2" step="0.1">
            <span class="stage-pause-slider-value">{{ playback.ttsRateMultiplier.value.toFixed(1) }}x</span>
          </label>
        </div>

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
