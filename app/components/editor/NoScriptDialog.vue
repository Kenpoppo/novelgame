<script setup lang="ts">
defineEmits<{ close: [] }>()
</script>

<template>
  <div class="no-script-dialog-overlay" @click.self="$emit('close')">
    <div class="no-script-dialog" role="dialog" aria-modal="true" aria-labelledby="no-script-dialog-title">
      <span class="no-script-dialog-icon">📖</span>
      <h2 id="no-script-dialog-title">台本がまだありません</h2>
      <p>
        セリフが1つも無いので、プレイ・プレビューできません。
        既存の台本を読み込むか、ストーリー編集画面でセリフを書いてください。
      </p>
      <div class="no-script-dialog-actions">
        <NuxtLink to="/editor/import" class="no-script-dialog-primary" @click="$emit('close')">
          📥 台本を読み込む
        </NuxtLink>
        <NuxtLink to="/editor/story" class="no-script-dialog-secondary" @click="$emit('close')">
          📖 ストーリーを書く
        </NuxtLink>
      </div>
      <button type="button" class="no-script-dialog-close" @click="$emit('close')">閉じる</button>
    </div>
  </div>
</template>
