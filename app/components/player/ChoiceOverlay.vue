<script setup lang="ts">
defineProps<{
  options: { text: string; target: string }[]
}>()

const emit = defineEmits<{ choose: [target: string] }>()
</script>

<template>
  <div class="choice-box">
    <button
      v-for="(option, index) in options"
      :key="index"
      type="button"
      class="choice-button"
      @click="emit('choose', option.target)"
    >
      {{ option.text }}
    </button>
  </div>
</template>
