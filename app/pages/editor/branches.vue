<script setup lang="ts">
import { compileProject } from '#shared/domain/project/compile'

const store = useProjectStore()
const router = useRouter()
const errors = ref<string[] | null>(null)

onMounted(() => {
  void store.load()
})

const labelCount = computed(
  () => (store.project?.beats ?? []).filter((beat) => beat.type === 'label').length,
)
const choiceCount = computed(
  () => (store.project?.beats ?? []).filter((beat) => beat.type === 'choice').length,
)
const jumpCount = computed(
  () => (store.project?.beats ?? []).filter((beat) => beat.type === 'jump').length,
)

function goPlay(): void {
  if (!store.project) return
  const result = compileProject(store.project)
  if (!result.ok) {
    errors.value = result.errors
    return
  }
  errors.value = null
  router.push('/play/local')
}
</script>

<template>
  <div v-if="store.project" class="editor">
    <SubPageHeader title="ストーリー展開(選択肢・分岐)">
      <template #actions>
        <button type="button" class="play-button play-button--compact" @click="goPlay">プレビュー →</button>
      </template>
    </SubPageHeader>

    <div class="subpage-body subpage-body--wide">
      <section class="panel branches-intro">
        <h2>選択肢と分岐を作る</h2>
        <p class="hint">
          ラベルで分岐先を作り、選択肢からそのラベルへ飛ばす形でストーリーを
          分岐させます。ジャンプはラベルへの無条件移動です。
        </p>
        <ul class="branches-summary">
          <li>ラベル: <strong>{{ labelCount }}</strong> 個</li>
          <li>選択肢: <strong>{{ choiceCount }}</strong> 個</li>
          <li>ジャンプ: <strong>{{ jumpCount }}</strong> 個</li>
        </ul>
        <p class="hint">
          手順の目安: ① 分岐先ごとに「+ラベル」で名前をつける → ② 分岐させたい
          場所で「+選択肢」を追加し、各選択肢に飛ばしたいラベル名を選ぶ →
          ③ 分岐が合流する場合は「+ジャンプ」で共通ラベルへ戻す。
        </p>
      </section>

      <StoryPanel />

      <div v-if="errors" class="error-banner">
        <p>プレイする前に、以下を直してください:</p>
        <ul>
          <li v-for="(message, index) in errors" :key="index">{{ message }}</li>
        </ul>
      </div>

      <div class="branches-footer">
        <NuxtLink to="/editor/all" class="branches-back">← 詳細設定へ戻る</NuxtLink>
        <button type="button" class="play-button" @click="goPlay">プレビューする →</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.branches-intro {
  margin-bottom: 20px;
}

.branches-summary {
  list-style: none;
  padding: 0;
  margin: 12px 0;
  display: flex;
  gap: 20px;
  font-weight: 700;
}

.branches-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 32px;
  padding-top: 20px;
  border-top: 2px dashed #d8cdbd;
}

.branches-back {
  font-weight: 800;
  color: var(--pop-blue-dark);
  text-decoration: none;
}

.branches-back:hover {
  text-decoration: underline;
}

.play-button--compact {
  padding: 8px 18px;
  font-size: 13px;
}
</style>
