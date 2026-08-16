<script setup lang="ts">
type Mode = 'character' | 'background'

interface PendingAssignment {
  file: File
  dataUrl: string
  baseName: string
  targetId: string
  slot: 'main' | 'alt'
}

const store = useProjectStore()

const menuOpen = ref(false)
const mode = ref<Mode | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)

const pending = ref<PendingAssignment[]>([])
const autoMatchedCount = ref(0)
const showDialog = ref(false)

/** ファイル名から拡張子を除いたもの。 */
function stripExt(filename: string): string {
  return filename.replace(/\.[^./\\]+$/, '')
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

// 背景には「既存の一覧と一致させる」概念が無い(キャラクターと違い、
// 決まったロスターに割り当てるのではなく都度ライブラリを増やしていくもの
// のため)。一致判定が要るのはキャラクターだけ。背景は選んだ画像を
// ファイル名(拡張子なし)を場面名として、そのまま新規登録する。
const targetList = computed<{ id: string; name: string }[]>(() => {
  if (mode.value === 'character') {
    return (store.project?.characters ?? []).map((c) => ({ id: c.id, name: c.name }))
  }
  return []
})

function openFilePicker(target: Mode): void {
  mode.value = target
  menuOpen.value = false
  fileInput.value?.click()
}

function applyImage(targetId: string, dataUrl: string, slot: 'main' | 'alt' = 'main'): void {
  if (!store.project) return
  const character = store.project.characters.find((c) => c.id === targetId)
  if (!character) return
  if (slot === 'alt') character.imageAltDataUrl = dataUrl
  else character.imageDataUrl = dataUrl
}

async function onFilesSelected(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  input.value = ''
  if (files.length === 0 || !store.project) return

  if (mode.value === 'background') {
    if (!store.project.backgrounds) store.project.backgrounds = []
    for (const file of files) {
      const dataUrl = await readFileAsDataUrl(file)
      store.project.backgrounds.push({
        id: crypto.randomUUID(),
        label: stripExt(file.name).trim() || file.name,
        imageDataUrl: dataUrl,
      })
    }
    resultMessage.value = `${files.length}件を背景として新規登録しました。`
    return
  }

  const candidates = targetList.value
  autoMatchedCount.value = 0
  pending.value = []

  for (const file of files) {
    const baseName = stripExt(file.name).trim()
    const dataUrl = await readFileAsDataUrl(file)
    const match = candidates.find((t) => t.name.trim() === baseName)
    if (match) {
      applyImage(match.id, dataUrl)
      autoMatchedCount.value++
    } else {
      pending.value.push({ file, dataUrl, baseName, targetId: '', slot: 'main' })
    }
  }

  if (pending.value.length > 0) {
    showDialog.value = true
  } else {
    resultMessage.value = `${autoMatchedCount.value}件を自動で設定しました。`
  }
}

const resultMessage = ref<string | null>(null)

function confirmPending(): void {
  let assignedCount = 0
  for (const p of pending.value) {
    if (p.targetId) {
      applyImage(p.targetId, p.dataUrl, p.slot)
      assignedCount++
    }
  }
  const skipped = pending.value.length - assignedCount
  resultMessage.value =
    `${autoMatchedCount.value}件を自動で設定` +
    (assignedCount > 0 ? `、${assignedCount}件を手動で設定` : '') +
    (skipped > 0 ? `、${skipped}件をスキップ` : '') +
    'しました。'
  showDialog.value = false
  pending.value = []
}

function cancelPending(): void {
  showDialog.value = false
  pending.value = []
  resultMessage.value = autoMatchedCount.value > 0 ? `${autoMatchedCount.value}件を自動で設定しました(残りはキャンセルされました)。` : null
}
</script>

<template>
  <div class="bulk-image-import">
    <button
      type="button"
      class="bulk-image-import-toggle"
      title="キャラクター: ファイル名(拡張子なし)が名前と一致すれば自動で設定されます。背景: ファイル名を場面名としてそのまま新規登録します。"
      @click="menuOpen = !menuOpen"
    >
      🖼️ 画像一括取り込み
    </button>
    <div v-if="menuOpen" class="bulk-image-import-menu">
      <p class="bulk-image-import-hint">
        キャラクター: ファイル名(拡張子なし)が名前と一致する画像は自動で設定されます。
        一致しない画像は、あとで割り当て先を選べます。<br>
        背景: 一致の概念はなく、選んだ画像をファイル名のまま新規の場面として登録します。
      </p>
      <div class="bulk-image-import-menu-buttons">
        <button type="button" @click="openFilePicker('character')">🧑‍🤝‍🧑 キャラクター</button>
        <button type="button" @click="openFilePicker('background')">🏞️ 背景</button>
      </div>
    </div>
    <input ref="fileInput" type="file" accept="image/*" multiple hidden @change="onFilesSelected">

    <p v-if="resultMessage" class="bulk-image-result">{{ resultMessage }}</p>

    <Teleport to="body">
      <div v-if="showDialog" class="bulk-image-dialog-overlay" @click.self="cancelPending">
        <div class="bulk-image-dialog" role="dialog" aria-modal="true">
          <h2>この画像はどのキャラクターに設定しますか?</h2>
          <p class="bulk-image-dialog-hint">
            ファイル名が一致した{{ autoMatchedCount }}件は自動で設定済みです。
            残り{{ pending.length }}件は割り当て先を選んでください(スキップも可)。
            キャラクターを選ぶと、画像A(既定)/画像B(別ポーズ・表情)のどちらに
            設定するかも選べます。
          </p>
          <ul class="bulk-image-dialog-list">
            <li v-for="p in pending" :key="p.file.name + p.file.size" class="bulk-image-dialog-item">
              <img :src="p.dataUrl" alt="" class="bulk-image-dialog-thumb">
              <span class="bulk-image-dialog-filename" :title="p.file.name">{{ p.file.name }}</span>
              <select v-model="p.targetId" class="bulk-image-dialog-select">
                <option value="">(スキップ)</option>
                <option v-for="t in targetList" :key="t.id" :value="t.id">{{ t.name }}</option>
              </select>
              <select v-if="p.targetId" v-model="p.slot" class="bulk-image-dialog-select bulk-image-dialog-slot">
                <option value="main">画像A</option>
                <option value="alt">画像B</option>
              </select>
            </li>
          </ul>
          <div class="bulk-image-dialog-actions">
            <button type="button" class="bulk-image-dialog-apply" @click="confirmPending">適用する</button>
            <button type="button" class="bulk-image-dialog-cancel" @click="cancelPending">キャンセル</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
