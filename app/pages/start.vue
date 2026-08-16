<script setup lang="ts">
import { parseScript } from '#shared/domain/parser'
import {
  analysisToProjectFragments,
  analyzeScriptHeuristically,
  dslResultToAnalysis,
  mergeProfilesIntoCharacters,
} from '#shared/domain/project/scriptImport'
import { parseProfileText } from '#shared/domain/project/profileImport'
import { createEmptyProject } from '#shared/domain/project/types'
import type { Beat, CharacterAsset } from '#shared/domain/project/types'

type Step =
  | 'title'
  | 'mode'
  | 'import'
  | 'profiles'
  | 'blank-title'
  | 'blank-characters'
  | 'done'

const PALETTE = ['#4fc3f7', '#f48fb1', '#aed581', '#ffb74d', '#ba68c8', '#4db6ac', '#7986cb', '#ff8a65']

interface AnalyzeResponse {
  ok: boolean
  reason?: string
  analysis?: {
    title: string | null
    characters: { name: string; color: string | null }[]
    beats: { speaker: string | null; text: string }[]
  }
}

const store = useProjectStore()
const router = useRouter()

const step = ref<Step>('title')

// import ルート用の状態
const scriptText = ref('')
const analyzing = ref(false)
const importError = ref<string | null>(null)
const importPreview = ref<{ title?: string; characters: CharacterAsset[]; beats: Beat[]; usedAi: boolean } | null>(null)
// 台本モードで解析したが「プロフィールっぽい」と判定した時のヒント。
const profileSuggestion = ref<{ count: number } | null>(null)
// 台本モードで解析した際、プロフィールを混合統合できた人数(統合完了メッセージ用)。
const mergedProfileCount = ref(0)

// プロフィール読み込みルート用の状態
const profileText = ref('')
const profilePreview = ref<{ name: string; color: string; notes?: string }[] | null>(null)
const profileError = ref<string | null>(null)

// blank ルート用の状態
const draftTitle = ref('')
const draftCharacters = ref<{ name: string; color: string }[]>([
  { name: '', color: PALETTE[0]! },
])

onMounted(() => {
  void store.load()
})

/** 開始: モード選択画面へ。 */
function begin(): void {
  step.value = 'mode'
}

function chooseImport(): void {
  step.value = 'import'
}

function chooseProfiles(): void {
  step.value = 'profiles'
}

function chooseBlank(): void {
  draftTitle.value = store.project?.title && store.project.title !== '無題のストーリー' ? store.project.title : ''
  step.value = 'blank-title'
}

// ── profiles ルート ───────────────────────────────────────────
function onProfileFileChange(event: Event): void {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    profileText.value = String(reader.result ?? '')
  }
  reader.readAsText(file)
}

function analyzeProfiles(): void {
  profileError.value = null
  profilePreview.value = null
  const entries = parseProfileText(profileText.value)
  if (entries.length === 0) {
    profileError.value = '登場人物が見つかりませんでした。空行で区切って「名前」+「説明」の形式で書かれているか確認してください。'
    return
  }
  profilePreview.value = entries.map((entry, index) => ({
    name: entry.name,
    color: entry.color ?? PALETTE[index % PALETTE.length]!,
    notes: entry.notes,
  }))
}

function applyProfiles(): void {
  if (!profilePreview.value || !store.project) return
  const characters: CharacterAsset[] = profilePreview.value.map((entry) => ({
    id: crypto.randomUUID(),
    name: entry.name,
    color: entry.color,
    notes: entry.notes,
  }))
  const empty = createEmptyProject(store.project.title || '無題のストーリー')
  store.project = { ...empty, characters }
  step.value = 'done'
}

// ── import ルート ────────────────────────────────────────────
function onScriptFileChange(event: Event): void {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    scriptText.value = String(reader.result ?? '')
  }
  reader.readAsText(file)
}

async function analyzeScript(): Promise<void> {
  if (!scriptText.value.trim()) return
  analyzing.value = true
  importError.value = null
  importPreview.value = null
  profileSuggestion.value = null
  mergedProfileCount.value = 0

  // タイトル抽出: 最初の非空行をタイトルとして扱う
  const lines = scriptText.value.split(/\r?\n/)
  const titleLineIndex = lines.findIndex((line) => line.trim().length > 0)
  const firstLineTitle = titleLineIndex >= 0 ? lines[titleLineIndex]!.trim() : ''
  const bodyText = titleLineIndex >= 0 ? lines.slice(titleLineIndex + 1).join('\n') : scriptText.value

  // 全文に対してプロフィール解析も走らせる。台本と混在していれば人物設定を統合する。
  const profileEntries = parseProfileText(scriptText.value)

  try {
    // まずDSL(自前フォーマット)を試す
    const parsed = parseScript(bodyText)
    const namedDialogueCount = parsed.instructions.filter(
      (instruction) => instruction.type === 'dialogue' && instruction.speaker !== null,
    ).length
    if (namedDialogueCount >= 2) {
      const fragments = analysisToProjectFragments(dslResultToAnalysis(parsed))
      const before = fragments.characters.length
      fragments.characters = mergeProfilesIntoCharacters(fragments.characters, profileEntries)
      mergedProfileCount.value = fragments.characters.length - before
      importPreview.value = { ...fragments, title: firstLineTitle || fragments.title, usedAi: false }
      return
    }

    // AI解析を試す
    const result = await $fetch<AnalyzeResponse>('/api/import/analyze', {
      method: 'POST',
      body: { text: bodyText },
    })
    if (result.ok && result.analysis) {
      const fragments = analysisToProjectFragments({
        title: result.analysis.title ?? undefined,
        characters: result.analysis.characters.map((c) => ({ name: c.name, color: c.color ?? undefined })),
        beats: result.analysis.beats,
      })
      const before = fragments.characters.length
      fragments.characters = mergeProfilesIntoCharacters(fragments.characters, profileEntries)
      mergedProfileCount.value = fragments.characters.length - before
      importPreview.value = { ...fragments, title: firstLineTitle || fragments.title, usedAi: true }
    } else {
      // ヒューリスティックにフォールバック
      const fragments = analysisToProjectFragments(analyzeScriptHeuristically(bodyText))
      const before = fragments.characters.length
      fragments.characters = mergeProfilesIntoCharacters(fragments.characters, profileEntries)
      mergedProfileCount.value = fragments.characters.length - before
      importPreview.value = { ...fragments, title: firstLineTitle || fragments.title, usedAi: false }
    }

    // 台本として解析したがキャラが少なく、プロフィール形式として読める場合はヒント。
    // 「セリフ「」がほぼ含まれない登場人物リスト」を投げ入れた時のフォロー。
    if (
      importPreview.value &&
      importPreview.value.beats.filter((b) => b.type === 'dialogue' && (b as { characterId: string | null }).characterId).length < 2 &&
      profileEntries.length >= 3
    ) {
      profileSuggestion.value = { count: profileEntries.length }
    }
  } catch {
    const fragments = analysisToProjectFragments(analyzeScriptHeuristically(bodyText))
    const before = fragments.characters.length
    fragments.characters = mergeProfilesIntoCharacters(fragments.characters, profileEntries)
    mergedProfileCount.value = fragments.characters.length - before
    importPreview.value = { ...fragments, title: firstLineTitle || fragments.title, usedAi: false }
  } finally {
    analyzing.value = false
  }
}

function switchToProfileMode(): void {
  profileText.value = scriptText.value
  scriptText.value = ''
  importPreview.value = null
  profileSuggestion.value = null
  step.value = 'profiles'
  // 自動的に解析まで走らせる
  analyzeProfiles()
}

function applyImport(): void {
  if (!importPreview.value || !store.project) return
  if (importPreview.value.title) store.project.title = importPreview.value.title
  store.project.characters = [...importPreview.value.characters]
  store.project.beats = [...importPreview.value.beats]
  step.value = 'done'
}

// ── blank ルート ─────────────────────────────────────────────
function addDraftCharacter(): void {
  draftCharacters.value.push({
    name: '',
    color: PALETTE[draftCharacters.value.length % PALETTE.length]!,
  })
}

function removeDraftCharacter(index: number): void {
  draftCharacters.value.splice(index, 1)
}

function goCharacters(): void {
  if (!store.project) return
  store.project.title = draftTitle.value.trim() || '無題のストーリー'
  step.value = 'blank-characters'
}

function finishBlank(): void {
  if (!store.project) return
  const empty = createEmptyProject(draftTitle.value.trim() || '無題のストーリー')
  const characters: CharacterAsset[] = draftCharacters.value
    .filter((c) => c.name.trim().length > 0)
    .map((c) => ({ id: crypto.randomUUID(), name: c.name.trim(), color: c.color }))
  store.project = { ...empty, characters }
  step.value = 'done'
}

// ── 完了 ─────────────────────────────────────────────────────
function goEditor(): void {
  router.push('/editor/all')
}

function goPreview(): void {
  router.push('/play/local')
}

function goMenu(): void {
  router.push('/editor')
}

function backTo(target: Step): void {
  step.value = target
}
</script>

<template>
  <div class="wizard">
    <!-- Step 1: タイトル画面 -->
    <section v-if="step === 'title'" class="wizard-hero">
      <img class="wizard-hero-mascot" src="/usagiicon1.png" alt="ヘッドホンウサギ">
      <h1>ノベルゲームメーカー</h1>
      <p class="wizard-hero-lead">
        キャラクター、背景、セリフを組み合わせて<br>
        あなただけのノベルゲームを作りましょう。
      </p>
      <button type="button" class="wizard-hero-cta" @click="begin">はじめる →</button>
      <NuxtLink to="/editor" class="wizard-skip">既存の編集を続ける →</NuxtLink>
      <p class="wizard-hero-credit">
        © {{ new Date().getFullYear() }} 浦和うさぎスタジオ
      </p>
    </section>

    <!-- Step 2: モード選択 -->
    <section v-else-if="step === 'mode'" class="wizard-body">
      <WizardStepBar :current="1" />
      <h2>どこから始めますか?</h2>
      <p class="wizard-hint">既にある素材があれば、そこから自動でセットアップします。何も無ければ「一から作る」でOK。</p>
      <div class="wizard-cards">
        <button type="button" class="wizard-card" @click="chooseImport">
          <span class="wizard-card-icon">📄</span>
          <span class="wizard-card-title">既存の台本を使う</span>
          <span class="wizard-card-desc">セリフや会話が入った .txt ファイル。AI/簡易解析でキャラとセリフを自動振り分け</span>
        </button>
        <button type="button" class="wizard-card" @click="chooseProfiles">
          <span class="wizard-card-icon">🪪</span>
          <span class="wizard-card-title">登場人物リストを読み込む</span>
          <span class="wizard-card-desc">名前+人物設定が書かれた .txt から、キャラクターを一括登録</span>
        </button>
        <button type="button" class="wizard-card" @click="chooseBlank">
          <span class="wizard-card-icon">✨</span>
          <span class="wizard-card-title">一から作る</span>
          <span class="wizard-card-desc">タイトルとキャラクターだけ先に決めて、後からセリフを書き足す</span>
        </button>
      </div>
      <button type="button" class="wizard-back" @click="backTo('title')">← 戻る</button>
    </section>

    <!-- Step 3a: 台本読み込み -->
    <section v-else-if="step === 'import'" class="wizard-body">
      <WizardStepBar :current="2" />
      <h2>台本を読み込む</h2>
      <p class="wizard-hint">
        テキスト形式の台本を貼り付けるか、.txt ファイルを選んでください。
        最初の行はタイトルとして扱います。
      </p>
      <div class="wizard-import-form">
        <input type="file" accept=".txt" @change="onScriptFileChange">
        <textarea v-model="scriptText" rows="14" placeholder="ここに台本を貼り付け…" />
        <button type="button" class="wizard-primary" :disabled="analyzing || !scriptText.trim()" @click="analyzeScript">
          {{ analyzing ? '解析中…' : '解析する' }}
        </button>
        <p v-if="importError" class="wizard-error">{{ importError }}</p>
      </div>

      <section v-if="importPreview" class="wizard-preview">
        <h3>解析結果 ({{ importPreview.usedAi ? 'AI解析' : '簡易解析' }})</h3>
        <p v-if="importPreview.title" class="wizard-preview-title">タイトル: <strong>{{ importPreview.title }}</strong></p>
        <p class="wizard-preview-meta">
          キャラ {{ importPreview.characters.length }}人 / セリフ {{ importPreview.beats.length }}件を検出しました。
        </p>
        <p v-if="mergedProfileCount > 0" class="wizard-preview-mergeinfo">
          🪪 台本内の「登場人物リスト」から{{ mergedProfileCount }}人の人物設定を統合しました。
        </p>
        <button type="button" class="wizard-primary" @click="applyImport">この内容で作成する →</button>
      </section>

      <section v-if="profileSuggestion" class="wizard-suggestion">
        <p>
          🪪 このテキストは「セリフのある台本」ではなく <strong>登場人物リスト</strong> のようです
          （{{ profileSuggestion.count }}人分を検出）。もしそうなら、
          「登場人物リストとして読み込む」に切り替えると<strong>キャラを一括登録</strong>できます。
        </p>
        <button type="button" class="wizard-secondary" @click="switchToProfileMode">
          🪪 登場人物リストとして読み込みなおす →
        </button>
      </section>

      <button type="button" class="wizard-back" @click="backTo('mode')">← モード選択へ戻る</button>
    </section>

    <!-- Step 3c: 登場人物リスト読み込み -->
    <section v-else-if="step === 'profiles'" class="wizard-body">
      <WizardStepBar :current="2" />
      <h2>登場人物リストを読み込む</h2>
      <p class="wizard-hint">
        「名前」+「人物設定（説明文）」を空行区切りで並べたテキスト、または JSON。
        検出したキャラクターは、色を自動で振り分けて登録します。
      </p>
      <div class="wizard-import-form">
        <input type="file" accept=".txt,.json" @change="onProfileFileChange">
        <textarea v-model="profileText" rows="14" placeholder="ここに登場人物リストを貼り付け…" />
        <button type="button" class="wizard-primary" :disabled="!profileText.trim()" @click="analyzeProfiles">
          解析する
        </button>
        <p v-if="profileError" class="wizard-error">{{ profileError }}</p>
      </div>

      <section v-if="profilePreview" class="wizard-preview">
        <h3>検出したキャラクター（{{ profilePreview.length }}人）</h3>
        <ul class="wizard-profile-list">
          <li v-for="entry in profilePreview" :key="entry.name" class="wizard-profile-item">
            <span class="wizard-profile-swatch" :style="{ background: entry.color }" />
            <div>
              <div class="wizard-profile-name">{{ entry.name }}</div>
              <p v-if="entry.notes" class="wizard-profile-notes">{{ entry.notes }}</p>
            </div>
          </li>
        </ul>
        <button type="button" class="wizard-primary" @click="applyProfiles">この内容でキャラを登録する →</button>
      </section>

      <button type="button" class="wizard-back" @click="backTo('mode')">← モード選択へ戻る</button>
    </section>

    <!-- Step 3b-1: タイトル入力 -->
    <section v-else-if="step === 'blank-title'" class="wizard-body">
      <WizardStepBar :current="2" />
      <h2>タイトルを決めましょう</h2>
      <p class="wizard-hint">いつでも後から変えられます。</p>
      <input v-model="draftTitle" type="text" class="wizard-title-input" placeholder="例: 秘密の放課後" @keydown.enter="goCharacters">
      <button type="button" class="wizard-primary" @click="goCharacters">次へ: 登場人物を決める →</button>
      <button type="button" class="wizard-back" @click="backTo('mode')">← モード選択へ戻る</button>
    </section>

    <!-- Step 3b-2: キャラクター簡易登録 -->
    <section v-else-if="step === 'blank-characters'" class="wizard-body">
      <WizardStepBar :current="3" />
      <h2>登場人物を追加しましょう</h2>
      <p class="wizard-hint">
        名前と色だけ決めます。画像やボイスは後から追加できます。
        空白のままにすると、その行は無視されます。
      </p>
      <ul class="wizard-char-list">
        <li v-for="(character, index) in draftCharacters" :key="index" class="wizard-char-row">
          <input v-model="character.color" type="color" class="wizard-char-color">
          <input v-model="character.name" type="text" placeholder="名前" class="wizard-char-name">
          <button type="button" class="wizard-char-remove" @click="removeDraftCharacter(index)" title="削除">×</button>
        </li>
      </ul>
      <button type="button" class="wizard-add-more" @click="addDraftCharacter">+ もう1人追加</button>

      <div class="wizard-actions">
        <button type="button" class="wizard-primary" @click="finishBlank">これで作成する →</button>
      </div>
      <button type="button" class="wizard-back" @click="backTo('blank-title')">← タイトルへ戻る</button>
    </section>

    <!-- Step 4: 完了 -->
    <section v-else-if="step === 'done'" class="wizard-body">
      <WizardStepBar :current="4" />
      <div class="wizard-done-hero">
        <img class="wizard-done-mascot" src="/usagiicon1.png" alt="">
        <div>
          <h2>✨ 基本セットアップ完了!</h2>
          <p class="wizard-hint">
            続けて、より詳しくカスタマイズしましょう。あとから何度でも編集できます。
          </p>
        </div>
      </div>
      <div class="wizard-done-actions">
        <button type="button" class="wizard-primary" @click="goEditor">詳細を編集する</button>
        <button type="button" class="wizard-secondary" @click="goPreview">今すぐプレビュー</button>
        <button type="button" class="wizard-secondary" @click="goMenu">メインメニューへ</button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.wizard {
  min-height: 100vh;
  background: linear-gradient(180deg, var(--brand-sky) 0%, var(--brand-water-bg) 55%, var(--brand-water-light) 100%);
  color: var(--brand-ink);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
}

/* ── タイトル画面 ─────────────────────────── */
.wizard-hero {
  max-width: 720px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}

.wizard-hero-mascot {
  width: min(180px, 40vw);
  height: auto;
  filter: drop-shadow(0 8px 12px rgba(0, 0, 0, 0.18));
  animation: mascot-bob 2.5s ease-in-out infinite;
}

@keyframes mascot-bob {
  0%, 100% { transform: translateY(0) rotate(-1deg); }
  50% { transform: translateY(-8px) rotate(2deg); }
}

.wizard-hero-credit {
  margin: 0;
  font-size: 12px;
  font-weight: 700;
  color: #6b5f52;
  opacity: 0.7;
}

.wizard-hero h1 {
  font-size: 56px;
  font-weight: 900;
  margin: 0;
  color: #fff;
  -webkit-text-stroke: 3px var(--brand-navy);
  paint-order: stroke fill;
  text-shadow: 0 8px 0 rgba(20, 60, 90, 0.25);
}

.wizard-hero-lead {
  font-size: 18px;
  font-weight: 600;
  line-height: 1.7;
  margin: 0;
}

.wizard-hero-cta {
  padding: 20px 56px;
  font-size: 22px;
  font-weight: 900;
  font-family: inherit;
  color: #fff;
  background: var(--brand-water);
  border: var(--pop-border-w) solid var(--brand-navy);
  border-radius: 999px;
  box-shadow: 0 8px 0 var(--brand-water-dark);
  cursor: pointer;
  transition: transform 0.1s ease, box-shadow 0.1s ease;
}

.wizard-hero-cta:hover {
  transform: translateY(-3px);
  box-shadow: 0 11px 0 var(--brand-water-dark);
  background: var(--brand-aqua);
}

.wizard-hero-cta:active {
  transform: translateY(3px);
  box-shadow: 0 3px 0 var(--brand-water-dark);
}

.wizard-skip {
  font-size: 14px;
  font-weight: 700;
  color: var(--brand-water-dark);
  text-decoration: none;
}

.wizard-skip:hover {
  text-decoration: underline;
}

/* ── ステップ画面 共通 ────────────────────── */
.wizard-body {
  width: 100%;
  max-width: 780px;
  background: var(--pop-card);
  border: var(--pop-border-w) solid var(--pop-ink);
  border-radius: var(--pop-radius-lg);
  box-shadow: 0 8px 0 var(--pop-shadow);
  padding: 36px 40px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.wizard-body h2 {
  font-size: 26px;
  font-weight: 900;
  margin: 0;
}

.wizard-hint {
  margin: 0;
  font-size: 14px;
  line-height: 1.7;
  color: #6b5f52;
}

.wizard-primary {
  align-self: flex-start;
  padding: 12px 26px;
  font-size: 15px;
  font-weight: 800;
  font-family: inherit;
  color: #fff;
  background: var(--brand-water);
  border: var(--pop-border-w) solid var(--brand-navy);
  border-radius: 999px;
  box-shadow: 0 5px 0 var(--brand-water-dark);
  cursor: pointer;
  transition: transform 0.1s ease, box-shadow 0.1s ease;
}

.wizard-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 7px 0 var(--brand-water-dark);
  background: var(--brand-aqua);
}

.wizard-primary:active,
.wizard-primary:disabled {
  transform: translateY(2px);
  box-shadow: 0 1px 0 var(--brand-water-dark);
}

.wizard-secondary {
  padding: 10px 22px;
  font-size: 14px;
  font-weight: 800;
  font-family: inherit;
  color: var(--brand-navy);
  background: #fff;
  border: 2px solid var(--brand-water-dark);
  border-radius: 999px;
  cursor: pointer;
}

.wizard-secondary:hover {
  background: var(--brand-water-light);
}

.wizard-back {
  align-self: flex-start;
  padding: 6px 14px;
  font-size: 13px;
  font-weight: 700;
  font-family: inherit;
  color: var(--brand-water-dark);
  background: transparent;
  border: none;
  cursor: pointer;
}

.wizard-back:hover {
  text-decoration: underline;
}

/* ── モード選択 ─────────────────────────── */
.wizard-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 20px;
}

.wizard-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 10px;
  padding: 32px 20px;
  background: #fbfaf6;
  border: var(--pop-border-w) solid var(--pop-ink);
  border-radius: var(--pop-radius-lg);
  box-shadow: 0 5px 0 var(--pop-shadow);
  cursor: pointer;
  transition: transform 0.1s ease, box-shadow 0.1s ease;
  font-family: inherit;
}

.wizard-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 0 var(--pop-shadow);
}

.wizard-card-icon {
  font-size: 44px;
}

.wizard-card-title {
  font-size: 18px;
  font-weight: 900;
  color: var(--pop-ink);
}

.wizard-card-desc {
  font-size: 13px;
  font-weight: 600;
  color: #6b5f52;
  line-height: 1.6;
}

/* ── 台本読み込み ─────────────────────────── */
.wizard-import-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.wizard-import-form textarea {
  width: 100%;
  font-family: inherit;
  font-size: 13px;
  padding: 12px;
  border: 2px solid var(--pop-ink);
  border-radius: var(--pop-radius-sm);
  resize: vertical;
}

.wizard-error {
  color: var(--pop-red-dark);
  font-weight: 700;
  font-size: 13px;
}

.wizard-preview {
  padding: 16px 20px;
  background: #eaf7ff;
  border: 2px dashed var(--pop-ink);
  border-radius: var(--pop-radius-sm);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.wizard-preview h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 800;
}

.wizard-preview-title,
.wizard-preview-meta {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
}

.wizard-preview-mergeinfo {
  margin: 0;
  padding: 6px 10px;
  background: #fff8dd;
  border: 2px solid var(--pop-yellow-dark);
  border-radius: 8px;
  font-size: 12px;
  font-weight: 700;
  color: var(--pop-ink);
}

.wizard-suggestion {
  padding: 14px 18px;
  background: #fff8dd;
  border: 2px dashed var(--pop-red);
  border-radius: var(--pop-radius-sm);
  display: flex;
  flex-direction: column;
  gap: 10px;
  font-size: 13px;
  line-height: 1.6;
}

.wizard-suggestion p {
  margin: 0;
}

.wizard-profile-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 260px;
  overflow-y: auto;
}

.wizard-profile-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 8px 12px;
  background: #fff;
  border: 2px solid var(--pop-ink);
  border-radius: var(--pop-radius-sm);
}

.wizard-profile-swatch {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid var(--pop-ink);
  flex-shrink: 0;
  margin-top: 2px;
}

.wizard-profile-name {
  font-weight: 800;
  font-size: 14px;
}

.wizard-profile-notes {
  margin: 4px 0 0;
  font-size: 12px;
  color: #6b5f52;
  white-space: pre-wrap;
}

/* ── タイトル入力 ─────────────────────────── */
.wizard-title-input {
  width: 100%;
  padding: 14px 18px;
  font-size: 20px;
  font-weight: 700;
  font-family: inherit;
  color: var(--pop-ink);
  border: 2px solid var(--pop-ink);
  border-radius: var(--pop-radius-sm);
  background: #fff;
}

/* ── キャラクター簡易登録 ─────────────────── */
.wizard-char-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.wizard-char-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: #fbfaf6;
  border: 2px solid var(--pop-ink);
  border-radius: var(--pop-radius-sm);
}

.wizard-char-color {
  width: 40px;
  height: 40px;
  padding: 0;
  border: 2px solid var(--pop-ink);
  border-radius: 8px;
  cursor: pointer;
}

.wizard-char-name {
  flex: 1;
  padding: 8px 12px;
  font-size: 15px;
  font-family: inherit;
  border: 2px solid var(--pop-ink);
  border-radius: 6px;
  background: #fff;
}

.wizard-char-remove {
  width: 32px;
  height: 32px;
  font-size: 18px;
  font-weight: 900;
  color: var(--pop-red-dark);
  background: #fff;
  border: 2px solid var(--pop-ink);
  border-radius: 999px;
  cursor: pointer;
}

.wizard-add-more {
  align-self: flex-start;
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 700;
  color: var(--pop-ink);
  background: #fff;
  border: 2px dashed var(--pop-ink);
  border-radius: 999px;
  cursor: pointer;
}

.wizard-actions {
  margin-top: 8px;
}

/* ── 完了 ─────────────────────────── */
.wizard-done-hero {
  display: flex;
  align-items: center;
  gap: 20px;
}

.wizard-done-mascot {
  width: 96px;
  height: auto;
  filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.2));
  animation: mascot-bob 2s ease-in-out infinite;
  flex-shrink: 0;
}

.wizard-done-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: flex-start;
}
</style>
