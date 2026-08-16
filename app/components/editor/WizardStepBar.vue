<script setup lang="ts">
defineProps<{ current: number }>()

const steps = [
  { label: '選ぶ' },
  { label: '内容' },
  { label: '登場人物' },
  { label: '完了' },
]
</script>

<template>
  <ol class="wizard-step-bar">
    <li
      v-for="(step, index) in steps"
      :key="index"
      class="wizard-step-bar-item"
      :class="{
        'wizard-step-bar-item--active': current === index + 1,
        'wizard-step-bar-item--done': current > index + 1,
      }"
    >
      <span class="wizard-step-bar-number">{{ index + 1 }}</span>
      <span class="wizard-step-bar-label">{{ step.label }}</span>
    </li>
  </ol>
</template>

<style scoped>
.wizard-step-bar {
  display: flex;
  gap: 12px;
  list-style: none;
  margin: 0 0 8px;
  padding: 0;
  align-items: center;
}

.wizard-step-bar-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 700;
  color: #8a7c6c;
}

.wizard-step-bar-number {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 999px;
  background: #fff;
  border: 2px solid var(--pop-ink);
  color: var(--pop-ink);
  font-weight: 900;
}

.wizard-step-bar-item--active .wizard-step-bar-number {
  background: var(--pop-yellow);
}

.wizard-step-bar-item--done .wizard-step-bar-number {
  background: var(--pop-green);
  color: #fff;
}

.wizard-step-bar-item--active .wizard-step-bar-label,
.wizard-step-bar-item--done .wizard-step-bar-label {
  color: var(--pop-ink);
}
</style>
