<script setup lang="ts">
// メール確認・OAuthコールバックの着地点。ログイン済みならエディタへ。
const user = useSupabaseUser()

watch(
  user,
  (value) => {
    if (value) navigateTo('/editor')
  },
  { immediate: true },
)
</script>

<template>
  <div class="login-page">
    <p>確認中です…</p>
  </div>
</template>
