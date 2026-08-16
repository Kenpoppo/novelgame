<script setup lang="ts">
const { showNoScriptDialog, compileErrors, goToPreview } = useGoToPreview()
</script>

<template>
  <button type="button" class="play-button play-button--compact" @click="goToPreview">
    プレビュー →
  </button>
  <Teleport to="body">
    <NoScriptDialog v-if="showNoScriptDialog" @close="showNoScriptDialog = false" />
    <div v-if="compileErrors" class="preview-button-error-overlay" @click.self="compileErrors = null">
      <div class="preview-button-error">
        <p>プレビューできません:</p>
        <ul>
          <li v-for="(message, index) in compileErrors" :key="index">{{ message }}</li>
        </ul>
        <button type="button" @click="compileErrors = null">閉じる</button>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.play-button--compact {
  padding: 8px 18px;
  font-size: 13px;
}

.preview-button-error-overlay {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(58, 46, 38, 0.55);
}

.preview-button-error {
  width: min(420px, 100%);
  padding: 24px 28px;
  background: var(--pop-card);
  border: var(--pop-border-w) solid var(--pop-ink);
  border-radius: var(--pop-radius-lg);
  box-shadow: 0 10px 0 var(--pop-shadow);
}

.preview-button-error p {
  margin: 0 0 8px;
  font-weight: 800;
}

.preview-button-error ul {
  margin: 0 0 16px;
  padding-left: 20px;
  line-height: 1.7;
}

.preview-button-error button {
  padding: 8px 20px;
  font-size: 13px;
  font-weight: 700;
  font-family: inherit;
  background: #fff;
  border: 2px solid var(--pop-ink);
  border-radius: 999px;
  cursor: pointer;
}
</style>
