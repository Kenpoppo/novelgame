<script setup lang="ts">
import { VoicevoxTts } from '../../../infrastructure/tts/voicevoxTts'
import { WebSpeechTts } from '../../../infrastructure/tts/webspeechTts'
import type { TtsService, TtsVoice } from '../../../infrastructure/tts/ttsService'
import { createDefaultTtsConfig } from '#shared/domain/project/types'

const store = useProjectStore()

/** プロジェクト側の tts オブジェクトを常に存在する状態にする(v-model 用)。 */
function ensureTts(): void {
  if (!store.project) return
  if (!store.project.tts) {
    store.project.tts = createDefaultTtsConfig()
  }
}

const voices = ref<TtsVoice[]>([])
const loading = ref(false)
const voicesError = ref<string | null>(null)

// tts設定を有効化していなくても、VOICEVOXが起動していれば検出して案内する
const voicevox = useVoicevoxDetection()

function useVoicevoxNow(): void {
  ensureTts()
  if (!store.project?.tts) return
  store.project.tts.enabled = true
  store.project.tts.engine = 'voicevox'
  void fetchVoices()
}

async function fetchVoices(): Promise<void> {
  if (!store.project?.tts) return
  loading.value = true
  voicesError.value = null
  try {
    const service: TtsService =
      store.project.tts.engine === 'voicevox'
        ? new VoicevoxTts(store.project.tts.voicevoxUrl ?? 'http://localhost:50021')
        : new WebSpeechTts()
    voices.value = await service.listVoices()
    if (voices.value.length === 0) {
      voicesError.value =
        store.project.tts.engine === 'voicevox'
          ? 'VOICEVOX が起動していない可能性があります(既定の http://localhost:50021 に接続できませんでした)。'
          : 'ブラウザで利用できる日本語の読み上げ音声が見つかりませんでした。'
    }
  } catch (err) {
    voicesError.value = `音声リストの取得に失敗しました: ${(err as Error).message}`
  } finally {
    loading.value = false
  }
}

async function testSpeak(): Promise<void> {
  if (!store.project?.tts) return
  const service: TtsService =
    store.project.tts.engine === 'voicevox'
      ? new VoicevoxTts(store.project.tts.voicevoxUrl ?? 'http://localhost:50021')
      : new WebSpeechTts()
  await service.speak('こんにちは、これはテスト音声です。', {})
}

async function testNarrationVoice(): Promise<void> {
  if (!store.project?.tts) return
  const service: TtsService =
    store.project.tts.engine === 'voicevox'
      ? new VoicevoxTts(store.project.tts.voicevoxUrl ?? 'http://localhost:50021')
      : new WebSpeechTts()
  await service.speak('これはナレーションのテスト音声です。', {
    voice: store.project.tts.narrationVoice,
    rate: store.project.tts.narrationRate,
    pitch: store.project.tts.narrationPitch,
  })
}

onMounted(() => {
  ensureTts()
  void fetchVoices()
  void voicevox.check(store.project?.tts?.voicevoxUrl)
})

watch(
  () => [store.project?.tts?.engine, store.project?.tts?.voicevoxUrl],
  () => {
    void fetchVoices()
  },
)

// 他コンポーネント(CharacterPanel)からもボイス一覧を参照できるように export する。
defineExpose({ voices, fetchVoices })
</script>

<template>
  <section v-if="store.project?.tts" class="panel">
    <h2>読み上げ(TTS)</h2>
    <p class="hint">
      キャラクターごとの声を割り当てると、セリフごとに自動で読み上げます。
      アップ済みのボイスファイルがあればそちらを優先。VOICEVOX を使う場合は
      アプリを起動しておく必要があります(高品質だが要インストール)。
    </p>

    <p v-if="voicevox.available.value && !(store.project.tts.enabled && store.project.tts.engine === 'voicevox')" class="tts-voicevox-hint">
      🎙️ VOICEVOXの起動を検出しました。キャラクターごとに声(話者)を選べます。
      <button type="button" @click="useVoicevoxNow">VOICEVOXを使う →</button>
    </p>

    <label class="tts-row">
      <input v-model="store.project.tts.enabled" type="checkbox">
      <span>読み上げを有効にする</span>
    </label>

    <label class="tts-row">
      <span class="tts-label">エンジン</span>
      <select v-model="store.project.tts.engine">
        <option value="webspeech">Web Speech(ブラウザ内蔵/ゼロ設定)</option>
        <option value="voicevox">VOICEVOX(要ローカル起動/高品質)</option>
      </select>
    </label>

    <label v-if="store.project.tts.engine === 'voicevox'" class="tts-row">
      <span class="tts-label">VOICEVOX URL</span>
      <input v-model="store.project.tts.voicevoxUrl" type="text" placeholder="http://localhost:50021">
    </label>

    <label class="tts-row">
      <input v-model="store.project.tts.narrateNarration" type="checkbox">
      <span>ナレーション(話者なし)も読み上げる</span>
    </label>

    <div v-if="store.project.tts.narrateNarration" class="tts-narration">
      <label class="tts-row">
        <span class="tts-label">ナレーションの声</span>
        <select v-model="store.project.tts.narrationVoice">
          <option :value="undefined">(規定の声)</option>
          <option v-for="voice in voices" :key="voice.id" :value="voice.id">{{ voice.name }}</option>
        </select>
      </label>
      <button type="button" class="tts-narration-test" @click="testNarrationVoice">▶ ナレーションを試聴</button>
    </div>

    <div class="tts-actions">
      <button type="button" @click="fetchVoices">
        {{ loading ? '読み込み中…' : '音声一覧を更新' }}
      </button>
      <button type="button" @click="testSpeak">テスト再生</button>
      <span class="tts-status">利用可能: {{ voices.length }}件</span>
    </div>

    <p v-if="voicesError" class="tts-error">{{ voicesError }}</p>
  </section>
</template>

<style scoped>
.tts-voicevox-hint {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin: 0 0 14px;
  padding: 10px 14px;
  background: #fff8dd;
  border: 2px solid var(--pop-yellow-dark);
  border-radius: var(--pop-radius-sm);
  font-size: 13px;
  font-weight: 700;
  color: var(--pop-ink);
}

.tts-voicevox-hint button {
  padding: 6px 14px;
  font-size: 13px;
  font-weight: 800;
  font-family: inherit;
  color: #fff;
  background: var(--brand-water, #4fa8d8);
  border: 2px solid var(--pop-ink);
  border-radius: 999px;
  cursor: pointer;
}

.tts-voicevox-hint button:hover {
  filter: brightness(1.08);
}

.tts-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
  font-weight: 700;
}

.tts-narration {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin: 0 0 10px 26px;
}

.tts-narration .tts-row {
  flex: 1;
  min-width: 220px;
  margin-bottom: 0;
}

.tts-narration-test {
  padding: 6px 14px;
  font-weight: 700;
  font-family: inherit;
  border: 2px solid var(--pop-ink);
  border-radius: 999px;
  background: #fff;
  cursor: pointer;
}

.tts-narration-test:hover {
  background: var(--pop-yellow);
}

.tts-label {
  min-width: 96px;
}

.tts-row select,
.tts-row input[type='text'] {
  flex: 1;
}

.tts-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 12px;
  flex-wrap: wrap;
}

.tts-actions button {
  padding: 6px 14px;
  font-weight: 700;
  border: 2px solid var(--pop-ink);
  border-radius: 999px;
  background: #fff;
  cursor: pointer;
}

.tts-actions button:hover {
  background: var(--pop-yellow);
}

.tts-status {
  font-size: 12px;
  color: #8a7c6c;
}

.tts-error {
  margin-top: 10px;
  padding: 8px 12px;
  border: 2px solid var(--pop-red);
  border-radius: 8px;
  background: #fff0f0;
  color: var(--pop-red-dark);
  font-size: 13px;
  font-weight: 600;
}
</style>
