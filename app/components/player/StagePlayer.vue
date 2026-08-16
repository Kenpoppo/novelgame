<script setup lang="ts">
import type { ParsedScript } from '#shared/domain/types'

const props = defineProps<{
  title: string
  script: ParsedScript
}>()

const started = ref(false)
const playback = usePlayback(props.script)

function handleStart(): void {
  started.value = true
  playback.start()
}

function handleKeydown(event: KeyboardEvent): void {
  if (!started.value) return
  if (event.code === 'Space' || event.code === 'Enter') {
    playback.advance()
  }
}

onMounted(() => window.addEventListener('keydown', handleKeydown))
onUnmounted(() => window.removeEventListener('keydown', handleKeydown))
</script>

<template>
  <TitleScreen v-if="!started" :title="title" @start="handleStart" />
  <div v-else class="stage">
    <ChoiceOverlay v-if="playback.choices.value" :options="playback.choices.value" @choose="playback.choose" />
    <DialogueBox
      :speaker-name="playback.speakerName.value"
      :speaker-color="playback.speakerColor.value"
      :speaker-image="playback.speakerImage.value"
      :text="playback.text.value"
      @advance="playback.advance"
    />
  </div>
</template>
