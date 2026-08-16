<script setup lang="ts">
const store = useProjectStore()

onMounted(() => {
  void store.load()
})
</script>

<template>
  <div v-if="store.project" class="editor">
    <SubPageHeader title="詳細設定(すべての設定)" />

    <div class="subpage-body subpage-body--wide">
      <label class="all-settings-title-label" for="all-settings-title">タイトル</label>
      <input id="all-settings-title" v-model="store.project.title" type="text" class="title-input all-settings-title-input" placeholder="タイトル">

      <div class="all-settings-layout">
        <aside class="all-settings-sidebar">
          <CharacterPanel />
          <AudioPanel />
        </aside>
        <StoryPanel />
      </div>
    </div>
  </div>
</template>
