<script setup lang="ts">
const store = useProjectStore()

onMounted(() => {
  void store.load()
})
</script>

<template>
  <div v-if="store.project" class="editor">
    <SubPageHeader title="キャラクター設定" />
    <div class="subpage-body">
      <CharacterPanel />
    </div>
  </div>
</template>
