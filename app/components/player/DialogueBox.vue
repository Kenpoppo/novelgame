<script setup lang="ts">
defineProps<{
  speakerName: string | null
  speakerColor?: string
  text: string
}>()

const emit = defineEmits<{ advance: [] }>()
</script>

<template>
  <div class="dialogue-box" @click="emit('advance')">
    <div v-if="speakerName" class="name-box" :style="{ color: speakerColor }">{{ speakerName }}</div>
    <div class="text-box">{{ text }}</div>
  </div>
</template>
