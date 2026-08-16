<script setup lang="ts">
import type { Beat } from '#shared/domain/project/types'

const store = useProjectStore()

const labelNames = computed(() =>
  (store.project?.beats ?? []).filter((beat) => beat.type === 'label').map((beat) => beat.name),
)

function moveBeat(index: number, delta: number): void {
  if (!store.project) return
  const beats = store.project.beats
  const target = index + delta
  if (target < 0 || target >= beats.length) return
  const [beat] = beats.splice(index, 1)
  if (!beat) return
  beats.splice(target, 0, beat)
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
  }

  project.beats.push(beat)
}
</script>

<template>
  <section class="panel">
    <h2>ストーリー</h2>

    <ol class="beat-list">
      <li v-for="(beat, index) in store.project?.beats ?? []" :key="beat.id" class="beat" :class="`beat-${beat.type}`">
        <div class="beat-controls">
          <button type="button" :disabled="index === 0" @click="moveBeat(index, -1)">▲</button>
          <button type="button" :disabled="index === (store.project?.beats.length ?? 0) - 1" @click="moveBeat(index, 1)">▼</button>
          <button type="button" @click="removeBeat(index)">削除</button>
        </div>

        <div class="beat-body">
          <template v-if="beat.type === 'dialogue'">
            <select v-model="beat.characterId">
              <option :value="null">(地の文)</option>
              <option v-for="character in store.project?.characters ?? []" :key="character.id" :value="character.id">
                {{ character.name }}
              </option>
            </select>
            <textarea v-model="beat.text" rows="2" placeholder="セリフ・地の文" />
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
    </div>
  </section>
</template>
