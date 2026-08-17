<script setup lang="ts">
defineProps<{ title: string; hasSave?: boolean }>()
const emit = defineEmits<{ start: []; resume: [] }>()
</script>

<template>
  <div class="title-screen">
    <h1>{{ title }}</h1>
    <button v-if="hasSave" type="button" class="start-button title-resume-button" @click="emit('resume')">
      続きから
    </button>
    <button type="button" class="start-button" @click="emit('start')">
      {{ hasSave ? '最初から' : 'はじめる' }}
    </button>
  </div>
</template>
