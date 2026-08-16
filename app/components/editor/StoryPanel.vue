<script setup lang="ts">
import type { Beat } from '#shared/domain/project/types'

const store = useProjectStore()

const labelNames = computed(() =>
  (store.project?.beats ?? []).filter((beat) => beat.type === 'label').map((beat) => beat.name),
)

/** ラベル位置ジャンプ用: 各ラベルの beats 内 index と名前を返す。 */
const labelJumpTargets = computed(() =>
  (store.project?.beats ?? [])
    .map((beat, index) => ({ beat, index }))
    .filter(({ beat }) => beat.type === 'label') as { beat: Extract<Beat, { type: 'label' }>; index: number }[],
)

function jumpToBeat(index: number): void {
  const el = document.getElementById(beatDomId(index))
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

function beatDomId(index: number): string {
  return `beat-${index}`
}

const jumpToNumber = ref('')
function jumpByNumber(): void {
  const n = parseInt(jumpToNumber.value, 10)
  if (Number.isNaN(n)) return
  const total = store.project?.beats.length ?? 0
  const clamped = Math.min(Math.max(1, n), total)
  jumpToBeat(clamped - 1)
}

/** 画像A・画像Bの両方が設定されている(=選ぶ意味がある)かどうか。 */
function characterHasBothImages(characterId: string): boolean {
  const character = store.project?.characters.find((c) => c.id === characterId)
  return !!character?.imageDataUrl && !!character?.imageAltDataUrl
}

/**
 * 指定ラベルの直後の最初の台詞ビートを短く要約する。
 * ジャンプ先や選択肢先が「どんな場面か」を編集画面で確認しやすくするため。
 */
function labelPreview(labelName: string): string {
  if (!store.project || !labelName) return ''
  const beats = store.project.beats
  const labelIndex = beats.findIndex((b) => b.type === 'label' && b.name === labelName)
  if (labelIndex < 0) return ''
  for (let i = labelIndex + 1; i < beats.length && i < labelIndex + 6; i++) {
    const b = beats[i]!
    if (b.type === 'dialogue' && b.text.trim().length > 0) {
      const preview = b.text.slice(0, 24)
      return `→ ${preview}${b.text.length > 24 ? '…' : ''}`
    }
  }
  return '→ (セリフなし)'
}

function onDialogueBgChange(beat: Extract<Beat, { type: 'dialogue' }>, event: Event): void {
  const value = (event.target as HTMLSelectElement).value
  if (value === '_keep_') {
    // 前のシーンの背景を継承する場合はプロパティ自体を削除する
    delete (beat as { backgroundId?: string | null }).backgroundId
    return
  }
  beat.backgroundId = value === '_none_' ? null : value
}

function moveBeat(index: number, delta: number): void {
  if (!store.project) return
  const beats = store.project.beats
  const target = index + delta
  if (target < 0 || target >= beats.length) return
  const [beat] = beats.splice(index, 1)
  if (!beat) return
  beats.splice(target, 0, beat)
}

function moveBeatTo(index: number, target: 'top' | 'bottom'): void {
  if (!store.project) return
  const beats = store.project.beats
  const [beat] = beats.splice(index, 1)
  if (!beat) return
  if (target === 'top') beats.unshift(beat)
  else beats.push(beat)
}

// ── ドラッグ&ドロップによる並び替え ─────────────────────
const dragFrom = ref<number | null>(null)
const dragOver = ref<number | null>(null)

function onDragStart(index: number, event: DragEvent): void {
  dragFrom.value = index
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    // Firefox 用: 何か文字列をセットしないとドラッグが開始されない
    event.dataTransfer.setData('text/plain', String(index))
  }
}

function onDragOver(index: number, event: DragEvent): void {
  if (dragFrom.value === null || dragFrom.value === index) return
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
  dragOver.value = index
}

function onDrop(index: number, event: DragEvent): void {
  event.preventDefault()
  if (dragFrom.value === null || dragFrom.value === index) {
    dragFrom.value = null
    dragOver.value = null
    return
  }
  if (!store.project) return
  const beats = store.project.beats
  const [beat] = beats.splice(dragFrom.value, 1)
  if (!beat) return
  // 前方から後方への移動時、splice で削除した分だけ target が1つずれる
  const target = dragFrom.value < index ? index - 1 : index
  beats.splice(target, 0, beat)
  dragFrom.value = null
  dragOver.value = null
}

function onDragEnd(): void {
  dragFrom.value = null
  dragOver.value = null
}

function removeBeat(index: number): void {
  store.project?.beats.splice(index, 1)
}

function addOption(beat: Extract<Beat, { type: 'choice' }>): void {
  beat.options.push({ text: '', target: labelNames.value[0] ?? '' })
}

function removeOption(beat: Extract<Beat, { type: 'choice' }>, index: number): void {
  beat.options.splice(index, 1)
}

/** `atIndex` を指定するとその位置に挿入し、省略すると末尾に追加する。 */
function addBeat(type: Beat['type'], atIndex?: number): void {
  if (!store.project) return
  const project = store.project
  const id = crypto.randomUUID()

  let beat: Beat
  switch (type) {
    case 'dialogue':
      beat = { id, type, characterId: null, text: '' }
      break
    case 'label':
      beat = { id, type, name: `label_${id.slice(0, 4)}` }
      break
    case 'jump':
      beat = { id, type, target: labelNames.value[0] ?? '' }
      break
    case 'choice':
      beat = { id, type, options: [{ text: '', target: labelNames.value[0] ?? '' }] }
      break
    case 'bgm':
      beat = { id, type, audioId: project.audio.find((cue) => cue.kind === 'bgm')?.id ?? null }
      break
    case 'se':
      beat = { id, type, audioId: project.audio.find((cue) => cue.kind === 'se')?.id ?? '' }
      break
    case 'background':
      beat = { id, type, backgroundId: project.backgrounds?.[0]?.id ?? null }
      break
  }

  if (atIndex === undefined) {
    project.beats.push(beat)
  } else {
    project.beats.splice(atIndex, 0, beat)
  }
}

// ── ビート間への挿入(セリフが大量にある台本の途中に1つ差し込みたい時用) ──
// 「末尾に追加してから並び替えボタンやドラッグで何十行も動かす」手間を無くす。
const insertMenuOpenAt = ref<number | null>(null)

function toggleInsertMenu(index: number): void {
  insertMenuOpenAt.value = insertMenuOpenAt.value === index ? null : index
}

function insertBeatAt(type: Beat['type'], index: number): void {
  addBeat(type, index)
  insertMenuOpenAt.value = null
}
</script>

<template>
  <section class="panel">
    <h2>ストーリー <span class="beat-count">({{ store.project?.beats.length ?? 0 }} ビート)</span></h2>

    <nav v-if="labelJumpTargets.length > 0 || (store.project?.beats.length ?? 0) >= 10" class="label-jumper">
      <span class="label-jumper-title">📍 ジャンプ:</span>
      <button
        v-for="target in labelJumpTargets"
        :key="target.beat.id"
        type="button"
        class="label-jumper-chip"
        @click="jumpToBeat(target.index)"
      >
        {{ target.beat.name }}
      </button>
      <form v-if="(store.project?.beats.length ?? 0) >= 10" class="label-jumper-number" @submit.prevent="jumpByNumber">
        <span>#</span>
        <input v-model="jumpToNumber" type="number" min="1" :max="store.project?.beats.length ?? 1" placeholder="番号">
        <button type="submit">移動</button>
      </form>
    </nav>

    <ol class="beat-list">
      <template v-for="(beat, index) in store.project?.beats ?? []" :key="beat.id">
        <li class="beat-insert-slot">
          <button type="button" class="beat-insert-toggle" title="この位置に挿入" @click="toggleInsertMenu(index)">
            {{ insertMenuOpenAt === index ? '×' : '+' }}
          </button>
          <div v-if="insertMenuOpenAt === index" class="beat-insert-menu">
            <button type="button" @click="insertBeatAt('dialogue', index)">+ 台詞</button>
            <button type="button" @click="insertBeatAt('label', index)">+ ラベル</button>
            <button type="button" @click="insertBeatAt('jump', index)">+ ジャンプ</button>
            <button type="button" @click="insertBeatAt('choice', index)">+ 選択肢</button>
            <button type="button" @click="insertBeatAt('bgm', index)">+ BGM</button>
            <button type="button" @click="insertBeatAt('se', index)">+ SE</button>
            <button type="button" @click="insertBeatAt('background', index)">+ 背景</button>
          </div>
        </li>
        <li
          :id="beatDomId(index)"
          class="beat"
          :class="[`beat-${beat.type}`, { 'beat--drag-over': dragOver === index, 'beat--dragging': dragFrom === index }]"
          draggable="true"
          @dragstart="onDragStart(index, $event)"
          @dragover="onDragOver(index, $event)"
          @drop="onDrop(index, $event)"
          @dragend="onDragEnd"
        >
        <div class="beat-controls">
          <span class="beat-drag-handle" title="ドラッグして並び替え">⋮⋮</span>
          <span class="beat-index">#{{ index + 1 }}</span>
          <button type="button" :disabled="index === 0" title="1つ上へ" @click="moveBeat(index, -1)">▲</button>
          <button type="button" :disabled="index === (store.project?.beats.length ?? 0) - 1" title="1つ下へ" @click="moveBeat(index, 1)">▼</button>
          <button type="button" :disabled="index === 0" title="先頭へ" @click="moveBeatTo(index, 'top')">⇈</button>
          <button type="button" :disabled="index === (store.project?.beats.length ?? 0) - 1" title="末尾へ" @click="moveBeatTo(index, 'bottom')">⇊</button>
          <button type="button" @click="removeBeat(index)">削除</button>
        </div>

        <div class="beat-body">
          <template v-if="beat.type === 'dialogue'">
            <select v-model="beat.characterId">
              <option :value="null">(ナレーション)</option>
              <option v-for="character in store.project?.characters ?? []" :key="character.id" :value="character.id">
                {{ character.name }}
              </option>
            </select>
            <textarea v-model="beat.text" rows="2" placeholder="セリフ・ナレーション" />
            <div class="beat-scene-options">
              <label
                v-if="beat.characterId && characterHasBothImages(beat.characterId)"
                class="beat-image-toggle"
              >
                <span>画像</span>
                <select
                  :value="beat.useAltImage ? 'alt' : 'main'"
                  @change="beat.useAltImage = ($event.target as HTMLSelectElement).value === 'alt'"
                >
                  <option value="main">画像A</option>
                  <option value="alt">画像B(別ポーズ/表情)</option>
                </select>
              </label>
              <label class="beat-bg-selector">
                <span>背景</span>
                <select :value="beat.backgroundId ?? '_keep_'" @change="onDialogueBgChange(beat, $event)">
                  <option value="_keep_">(前のまま)</option>
                  <option value="_none_">(背景なし)</option>
                  <option
                    v-for="bg in store.project?.backgrounds ?? []"
                    :key="bg.id"
                    :value="bg.id"
                  >{{ bg.label }}</option>
                </select>
              </label>
            </div>
          </template>

          <template v-else-if="beat.type === 'label'">
            <span class="label-prefix">ラベル:</span>
            <input v-model="beat.name" type="text">
          </template>

          <template v-else-if="beat.type === 'jump'">
            <select v-model="beat.target" :disabled="labelNames.length === 0">
              <option v-if="labelNames.length === 0" value="">(ラベルがありません)</option>
              <option v-for="name in labelNames" :key="name" :value="name">{{ name }}</option>
            </select>
            <span v-if="beat.target" class="label-preview">{{ labelPreview(beat.target) }}</span>
          </template>

          <template v-else-if="beat.type === 'choice'">
            <div class="choice-option-list">
              <div v-for="(option, optionIndex) in beat.options" :key="optionIndex" class="choice-option-row">
                <input v-model="option.text" type="text" placeholder="選択肢テキスト">
                <select v-model="option.target" :disabled="labelNames.length === 0">
                  <option v-if="labelNames.length === 0" value="">(ラベルがありません)</option>
                  <option v-for="name in labelNames" :key="name" :value="name">{{ name }}</option>
                </select>
                <span v-if="option.target" class="label-preview label-preview--inline">{{ labelPreview(option.target) }}</span>
                <button type="button" @click="removeOption(beat, optionIndex)">×</button>
              </div>
            </div>
            <button type="button" @click="addOption(beat)">+ 選択肢を追加</button>
          </template>

          <template v-else-if="beat.type === 'bgm'">
            <select v-model="beat.audioId">
              <option :value="null">(停止)</option>
              <option
                v-for="cue in (store.project?.audio ?? []).filter((c) => c.kind === 'bgm')"
                :key="cue.id"
                :value="cue.id"
              >
                {{ cue.label }}
              </option>
            </select>
          </template>

          <template v-else-if="beat.type === 'se'">
            <select v-model="beat.audioId">
              <option
                v-for="cue in (store.project?.audio ?? []).filter((c) => c.kind === 'se')"
                :key="cue.id"
                :value="cue.id"
              >
                {{ cue.label }}
              </option>
            </select>
          </template>

          <template v-else-if="beat.type === 'background'">
            <select v-model="beat.backgroundId">
              <option :value="null">(既定/背景なし)</option>
              <option
                v-for="bg in store.project?.backgrounds ?? []"
                :key="bg.id"
                :value="bg.id"
              >
                {{ bg.label }}
              </option>
            </select>
          </template>
        </div>
        </li>
      </template>
    </ol>

    <div class="beat-toolbar">
      <button type="button" @click="addBeat('dialogue')">+ 台詞</button>
      <button type="button" @click="addBeat('label')">+ ラベル</button>
      <button type="button" @click="addBeat('jump')">+ ジャンプ</button>
      <button type="button" @click="addBeat('choice')">+ 選択肢</button>
      <button type="button" @click="addBeat('bgm')">+ BGM</button>
      <button type="button" @click="addBeat('se')">+ SE</button>
      <button type="button" @click="addBeat('background')">+ 背景</button>
    </div>
  </section>
</template>
