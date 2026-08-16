<script setup lang="ts">
const store = useProjectStore()

onMounted(() => {
  void store.load()
})
</script>

<template>
  <div v-if="store.project" class="editor">
    <SubPageHeader title="詳細設定(すべての設定)">
      <template #actions>
        <NuxtLink to="/editor/branches" class="publish-button all-settings-next-button all-settings-next-button--compact">
          次の段階へ →
        </NuxtLink>
      </template>
    </SubPageHeader>

    <div class="subpage-body subpage-body--wide">
      <label class="all-settings-title-label" for="all-settings-title">タイトル</label>
      <input id="all-settings-title" v-model="store.project.title" type="text" class="title-input all-settings-title-input" placeholder="タイトル">

      <BulkImageImport />

      <div class="all-settings-layout">
        <aside class="all-settings-sidebar">
          <CharacterPanel />
          <AudioPanel />
          <BackgroundPanel />
          <TtsPanel />
        </aside>
        <StoryPanel />
      </div>

      <div class="all-settings-next">
        <p class="all-settings-next-hint">
          キャラクター・音源・ストーリーの土台ができたら、次はストーリー展開
          (選択肢や分岐)を作り込みましょう。
        </p>
        <NuxtLink to="/editor/branches" class="publish-button all-settings-next-button">
          次の段階へ: ストーリー展開を作る →
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<style scoped>
.all-settings-next {
  margin-top: 32px;
  padding-top: 20px;
  border-top: 2px dashed #d8cdbd;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
}

.all-settings-next-hint {
  margin: 0;
  font-weight: 600;
  color: var(--pop-ink);
}

.all-settings-next-button {
  text-decoration: none;
  display: inline-block;
}

.all-settings-next-button--compact {
  padding: 8px 18px;
  font-size: 13px;
}
</style>
