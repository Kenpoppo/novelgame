<script setup lang="ts">
const supabase = useSupabaseClient()
const email = ref('')
const password = ref('')
const mode = ref<'signin' | 'signup'>('signin')
const message = ref<string | null>(null)
const router = useRouter()

async function submit(): Promise<void> {
  message.value = null

  const { error } =
    mode.value === 'signin'
      ? await supabase.auth.signInWithPassword({ email: email.value, password: password.value })
      : await supabase.auth.signUp({ email: email.value, password: password.value })

  if (error) {
    message.value = error.message
    return
  }

  router.push('/editor')
}
</script>

<template>
  <div class="login-page">
    <form class="login-form" @submit.prevent="submit">
      <h1>{{ mode === 'signin' ? 'ログイン' : '新規登録' }}</h1>
      <input v-model="email" type="email" placeholder="メールアドレス" required>
      <input v-model="password" type="password" placeholder="パスワード" required minlength="6">
      <button type="submit">{{ mode === 'signin' ? 'ログイン' : '登録' }}</button>
      <button type="button" @click="mode = mode === 'signin' ? 'signup' : 'signin'">
        {{ mode === 'signin' ? 'アカウントを作成する' : 'ログインへ戻る' }}
      </button>
      <p v-if="message">{{ message }}</p>
    </form>
  </div>
</template>
