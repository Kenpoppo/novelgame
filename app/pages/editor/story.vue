<script setup lang="ts">
const store = useProjectStore()

onMounted(() => {
  void store.load()
})
</script>

<template>
  <div v-if="store.project" class="editor">
    <SubPageHeader title="ストーリー編集" />
    <div class="subpage-body subpage-body--wide">
      <StoryPanel />
    </div>
  </div>
</template>
