<script setup lang="ts">
const props = defineProps<{
  speakerName: string | null
  speakerColor?: string
  text: string
}>()

const emit = defineEmits<{ advance: [] }>()

/**
 * 背景色の明るさに応じて、上に載せる文字色を自動選択する。
 * (WCAG の相対輝度に近い加重平均: 0.299R + 0.587G + 0.114B)
 */
function contrastText(hex: string | undefined): string {
  if (!hex) return '#fff'
  const raw = hex.replace('#', '').trim()
  const expanded = raw.length === 3
    ? raw.split('').map((c) => c + c).join('')
    : raw
  if (expanded.length !== 6) return '#fff'
  const r = parseInt(expanded.slice(0, 2), 16)
  const g = parseInt(expanded.slice(2, 4), 16)
  const b = parseInt(expanded.slice(4, 6), 16)
  if ([r, g, b].some((v) => Number.isNaN(v))) return '#fff'
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.6 ? '#2a231b' : '#ffffff'
}

const nameBackground = computed(() => props.speakerColor ?? '#3ca9ff')
const nameForeground = computed(() => contrastText(props.speakerColor))
</script>

<template>
  <div class="dialogue-box" @click="emit('advance')">
    <div
      v-if="speakerName"
      class="name-box"
      :style="{ background: nameBackground, color: nameForeground }"
    >{{ speakerName }}</div>
    <div class="text-box">{{ text }}</div>
  </div>
</template>
