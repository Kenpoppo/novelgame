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

function characterHasAlt(characterId: string): boolean {
  const character = store.project?.characters.find((c) => c.id === characterId)
  return !!character?.imageAltDataUrl
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

function removeBeat(index: number): void {
  store.project?.beats.splice(index, 1)
}

function addOption(beat: Extract<Beat, { type: 'choice' }>): void {
  beat.options.push({ text: '', target: labelNames.value[0] ?? '' })
}

function removeOption(beat: Extract<Beat, { type: 'choice' }>, index: number): void {
  beat.options.splice(index, 1)
}

function addBeat(type: Beat['type']): void {
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

  project.beats.push(beat)
}
</script>

<template>
  <section class="panel">
    <h2>ストーリー <span class="beat-count">({{ store.project?.beats.length ?? 0 }} ビート)</span></h2>

    <nav v-if="labelJumpTargets.length > 0" class="label-jumper">
      <span class="label-jumper-title">📍 ラベルへ移動:</span>
      <button
        v-for="target in labelJumpTargets"
        :key="target.beat.id"
        type="button"
        class="label-jumper-chip"
        @click="jumpToBeat(target.index)"
      >
        {{ target.beat.name }}
      </button>
    </nav>

    <ol class="beat-list">
      <li
        v-for="(beat, index) in store.project?.beats ?? []"
        :key="beat.id"
        :id="beatDomId(index)"
        class="beat"
        :class="`beat-${beat.type}`"
      >
        <div class="beat-controls">
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
                v-if="beat.characterId && characterHasAlt(beat.characterId)"
                class="beat-image-toggle"
              >
                <input v-model="beat.useAltImage" type="checkbox">
                画像B(別ポーズ/表情)を使う
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
          </template>

          <template v-else-if="beat.type === 'choice'">
            <div class="choice-option-list">
              <div v-for="(option, optionIndex) in beat.options" :key="optionIndex" class="choice-option-row">
                <input v-model="option.text" type="text" placeholder="選択肢テキスト">
                <select v-model="option.target" :disabled="labelNames.length === 0">
                  <option v-if="labelNames.length === 0" value="">(ラベルがありません)</option>
                  <option v-for="name in labelNames" :key="name" :value="name">{{ name }}</option>
                </select>
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
