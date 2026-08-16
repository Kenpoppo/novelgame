<script setup lang="ts">
defineProps<{
  speakerName: string | null
  speakerColor?: string
  speakerImage?: string
  text: string
}>()

const emit = defineEmits<{ advance: [] }>()
</script>

<template>
  <div class="dialogue-box" @click="emit('advance')">
    <img v-if="speakerImage" class="avatar-box" :src="speakerImage" alt="">
    <div v-if="speakerName" class="name-box" :style="{ color: speakerColor }">{{ speakerName }}</div>
    <div class="text-box">{{ text }}</div>
  </div>
</template>
