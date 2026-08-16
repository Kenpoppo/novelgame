<script setup lang="ts">
const store = useProjectStore()
const text = ref('')
const router = useRouter()

const { analyzing, errorMessage, preview, breakdown, profileSuggestion, analyze } = useScriptImportAnalysis()

onMounted(() => {
  void store.load()
})

function onFileChange(event: Event): void {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = () => {
    text.value = String(reader.result ?? '')
  }
  reader.readAsText(file)
}

function apply(): void {
  if (!preview.value || !store.project) return
  const hasExistingContent = store.project.beats.length > 0 || store.project.characters.length > 0
  if (hasExistingContent && !window.confirm('現在のタイトル・キャラクター・ストーリーを、読み込んだ内容で置き換えます。よろしいですか?')) {
    return
  }
  if (preview.value.title) {
    store.project.title = preview.value.title
  }
  store.project.characters = [...preview.value.characters]
  store.project.beats = [...preview.value.beats]
  router.push('/editor/all')
}

function goProfiles(): void {
  router.push('/editor/profiles')
}
</script>

<template>
  <div v-if="store.project" class="editor">
    <SubPageHeader title="台本を読み込む" />
    <PopLoading v-if="analyzing" message="台本を解析中…" />

    <div class="subpage-body subpage-body--wide">
      <section class="panel">
        <h2>台本を読み込む</h2>
        <p class="hint">
          既存の台本(テキスト)を貼り付けるかファイルを選ぶと、キャラクターと
          セリフを自動で読み取ります。可能ならAIで解析し、使えない場合は
          簡易的なルールベース解析にフォールバックします。選択肢・分岐は
          自動設定されないため、反映後にストーリー編集で追加してください。
          テキストの最初の行はタイトルとして扱います(本文には含めません)。
          反映時は現在のタイトル・キャラクター・ストーリーを読み込んだ内容で
          置き換えます(音源はそのまま残ります)。
        </p>
        <form class="import-form" @submit.prevent="analyze(text)">
          <input type="file" accept=".txt" @change="onFileChange">
          <textarea v-model="text" rows="14" placeholder="ここに台本を貼り付け…" />
          <button type="submit" :disabled="analyzing || !text.trim()">解析する</button>
        </form>
        <p v-if="errorMessage" class="error-banner">{{ errorMessage }}</p>
      </section>

      <section v-if="preview" class="panel">
        <h2>解析結果プレビュー({{ preview.usedAi ? 'AI解析' : '簡易解析' }})</h2>
        <p v-if="preview.title" class="import-preview-title">
          タイトル: <strong>{{ preview.title }}</strong>
        </p>
        <p class="import-preview-meta">
          キャラクター {{ preview.characters.length }}人 / セリフ・ナレーション {{ preview.beats.length }}件を検出しました。
        </p>
        <p v-if="breakdown.profileOnlyAdded > 0" class="import-preview-mergeinfo">
          🪪 台本内の「登場人物リスト」から{{ breakdown.profileOnlyAdded }}人の人物設定を統合しました。
        </p>

        <details class="import-breakdown">
          <summary>解析内訳を見る</summary>
          <ul>
            <li>台本解析で検出したキャラクター: <strong>{{ breakdown.scriptCharacters }}人</strong>(セリフに現れる話者)</li>
            <li>
              「登場人物」セクションの検出:
              <strong>{{ breakdown.profileSectionFound ? '見つかった' : '見つからなかった' }}</strong>
              <template v-if="breakdown.profileSectionFound">
                (<code>【登場人物】</code>の見出しから次の<code>【〜】</code>見出しか区切り線までを人物設定として抽出)
              </template>
            </li>
            <li>プロフィール解析で見つけた人物設定: <strong>{{ breakdown.profileEntries }}人</strong></li>
            <li>台本のキャラと名前が一致して統合(notes補完): <strong>{{ breakdown.mergedEntries }}人</strong></li>
            <li>プロフィールにしかない新規追加: <strong>{{ breakdown.profileOnlyAdded }}人</strong></li>
          </ul>
          <p class="import-breakdown-note">
            もし想定より人数が多い場合は、台本の中に<code>【登場人物】</code>のような見出しが無く、
            人物設定と本編セリフの境界を判定できなかった可能性があります。見出しを追加するか、
            「プロフィール読み込み」画面で人物設定だけを別途読み込んでください。
          </p>
        </details>

        <ul class="character-list">
          <li v-for="character in preview.characters" :key="character.id" class="character-item">
            <span class="character-swatch" :style="{ background: character.color ?? '#8ec5ff' }" />
            <span class="character-name">{{ character.name }}</span>
          </li>
        </ul>
        <button type="button" class="publish-button" @click="apply">この内容を反映する</button>
      </section>

      <section v-if="profileSuggestion" class="panel import-suggestion">
        <p>
          🪪 このテキストは「セリフのある台本」ではなく<strong>登場人物リスト</strong>のようです
          ({{ profileSuggestion.count }}人分を検出)。もしそうなら、
          「プロフィール読み込み」画面から読み込むと<strong>キャラを一括登録</strong>できます。
        </p>
        <button type="button" class="publish-button" @click="goProfiles">🪪 プロフィール読み込み画面へ →</button>
      </section>
    </div>
  </div>
</template>
