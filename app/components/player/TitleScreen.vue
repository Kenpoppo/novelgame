<script setup lang="ts">
defineProps<{ title: string }>()
const emit = defineEmits<{ start: [] }>()
</script>

<template>
  <div class="title-screen">
    <h1>{{ title }}</h1>
    <button type="button" class="start-button" @click="emit('start')">はじめる</button>
  </div>
</template>
