<script setup lang="ts">
import type { ParsedScript } from '#shared/domain/types'
import type { TtsConfig } from '#shared/domain/project/types'

const props = defineProps<{
  title: string
  script: ParsedScript
  tts?: TtsConfig
}>()

const started = ref(false)
const playback = usePlayback(props.script, props.tts)

function handleStart(): void {
  started.value = true
  playback.start()
}

function handleKeydown(event: KeyboardEvent): void {
  if (!started.value) return
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
    <NuxtLink to="/" class="stage-home-button" aria-label="ホームへ戻る" title="ホームへ戻る">
      🏠
    </NuxtLink>
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
  </div>
</template>
