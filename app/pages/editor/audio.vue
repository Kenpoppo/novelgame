<script setup lang="ts">
const store = useProjectStore()

onMounted(() => {
  void store.load()
})
</script>

<template>
  <div v-if="store.project" class="editor">
    <SubPageHeader title="音源設定(BGM/SE)" />
    <div class="subpage-body">
      <AudioPanel />
    </div>
  </div>
</template>
