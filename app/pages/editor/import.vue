<script setup lang="ts">
import { parseScript } from '#shared/domain/parser'
import {
  analysisToProjectFragments,
  analyzeScriptHeuristically,
  dslResultToAnalysis,
} from '#shared/domain/project/scriptImport'
import type { Beat, CharacterAsset } from '#shared/domain/project/types'

interface AnalyzeResponse {
  ok: boolean
  reason?: string
  analysis?: { title: string | null; characters: { name: string; color: string | null }[]; beats: { speaker: string | null; text: string }[] }
}

const store = useProjectStore()
const text = ref('')
const analyzing = ref(false)
const errorMessage = ref<string | null>(null)
const preview = ref<{ title?: string; characters: CharacterAsset[]; beats: Beat[]; usedAi: boolean } | null>(null)
const router = useRouter()

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

async function analyze(): Promise<void> {
  if (!text.value.trim()) return
  analyzing.value = true
  errorMessage.value = null
  preview.value = null

  // 最初の非空行をタイトルとして扱い、それ以降を本文として解析する。
  // タイトル行を本文から除外することで、解析結果のセリフ・地の文に混入しない。
  const lines = text.value.split(/\r?\n/)
  const titleLineIndex = lines.findIndex((line) => line.trim().length > 0)
  const firstLineTitle = titleLineIndex >= 0 ? lines[titleLineIndex]!.trim() : ''
  const bodyText = titleLineIndex >= 0 ? lines.slice(titleLineIndex + 1).join('\n') : text.value

  try {
    // 1. 自前のテキスト台本DSLに沿っているか、まず試す(高精度)。
    // 地の文も type:'dialogue'(speaker:null) になるため、「@charで登録された
    // キャラクターの発言」が2件以上あるかで判定する(単なる平文との区別)。
    const parsed = parseScript(bodyText)
    const namedDialogueCount = parsed.instructions.filter(
      (instruction) => instruction.type === 'dialogue' && instruction.speaker !== null,
    ).length
    if (namedDialogueCount >= 2) {
      const fragments = analysisToProjectFragments(dslResultToAnalysis(parsed))
      preview.value = { ...fragments, title: firstLineTitle || fragments.title, usedAi: false }
      return
    }

    // 2. AIでの解析を試す(サーバー側でANTHROPIC_API_KEY未設定なら ok:false)
    const result = await $fetch<AnalyzeResponse>('/api/import/analyze', {
      method: 'POST',
      body: { text: bodyText },
    })

    if (result.ok && result.analysis) {
      const fragments = analysisToProjectFragments({
        title: result.analysis.title ?? undefined,
        characters: result.analysis.characters.map((character) => ({
          name: character.name,
          color: character.color ?? undefined,
        })),
        beats: result.analysis.beats,
      })
      preview.value = { ...fragments, title: firstLineTitle || fragments.title, usedAi: true }
      return
    }

    // 3. AIが使えない/失敗した場合はヒューリスティック解析にフォールバック
    const fragments = analysisToProjectFragments(analyzeScriptHeuristically(bodyText))
    preview.value = { ...fragments, title: firstLineTitle || fragments.title, usedAi: false }
  } catch {
    const fragments = analysisToProjectFragments(analyzeScriptHeuristically(bodyText))
    preview.value = { ...fragments, title: firstLineTitle || fragments.title, usedAi: false }
  } finally {
    analyzing.value = false
  }
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
        <form class="import-form" @submit.prevent="analyze">
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
        <ul class="character-list">
          <li v-for="character in preview.characters" :key="character.id" class="character-item">
            <span class="character-swatch" :style="{ background: character.color ?? '#8ec5ff' }" />
            <span class="character-name">{{ character.name }}</span>
          </li>
        </ul>
        <button type="button" class="publish-button" @click="apply">この内容を反映する</button>
      </section>
    </div>
  </div>
</template>
