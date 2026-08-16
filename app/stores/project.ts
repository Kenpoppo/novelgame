import { indexedDbProjectRepository } from '../../infrastructure/local/indexedDbProjectRepository'
import { createEmptyProject } from '#shared/domain/project/types'
import type { CharacterAsset, Project } from '#shared/domain/project/types'

const MAX_HISTORY = 50

export const useProjectStore = defineStore('project', () => {
  const project = ref<Project | null>(null)
  const libraryCharacters = ref<CharacterAsset[]>([])
  const loaded = ref(false)
  // 自動保存の状態: idle=待機/saving=保存中/saved=直近で保存完了
  const saveState = ref<'idle' | 'saving' | 'saved'>('idle')
  const lastSavedAt = ref<Date | null>(null)

  // アンドゥ/リドゥ用の履歴スタック。編集内容の JSON スナップショットを保持する。
  const history = ref<string[]>([])
  const future = ref<string[]>([])
  const isRestoring = ref(false)
  let historyTimer: ReturnType<typeof setTimeout> | null = null

  const canUndo = computed(() => history.value.length > 1)
  const canRedo = computed(() => future.value.length > 0)

  async function load(): Promise<void> {
    if (loaded.value) return
    const existing = await indexedDbProjectRepository.getCurrentProject()
    project.value = existing ?? createEmptyProject()
    if (!existing && project.value) {
      await indexedDbProjectRepository.saveCurrentProject(project.value)
    }
    libraryCharacters.value = await indexedDbProjectRepository.listLibraryCharacters()
    loaded.value = true
    // 初期状態を履歴の起点として登録
    history.value = [JSON.stringify(project.value)]
    future.value = []
  }

  async function persist(): Promise<void> {
    if (!project.value) return
    saveState.value = 'saving'
    try {
      await indexedDbProjectRepository.saveCurrentProject(project.value)
      lastSavedAt.value = new Date()
      saveState.value = 'saved'
    } catch {
      saveState.value = 'idle'
    }
  }

  function undo(): void {
    if (history.value.length <= 1) return
    // 現在状態を future に退避し、直前状態を復元する
    const current = history.value.pop()!
    future.value.push(current)
    const previous = history.value[history.value.length - 1]
    if (!previous) return
    isRestoring.value = true
    project.value = JSON.parse(previous) as Project
    void nextTick(() => {
      isRestoring.value = false
    })
  }

  function redo(): void {
    const next = future.value.pop()
    if (!next) return
    history.value.push(next)
    isRestoring.value = true
    project.value = JSON.parse(next) as Project
    void nextTick(() => {
      isRestoring.value = false
    })
  }

  async function refreshLibrary(): Promise<void> {
    libraryCharacters.value = await indexedDbProjectRepository.listLibraryCharacters()
  }

  watch(
    project,
    () => {
      // 常に永続化する(復元時も含めて)
      void persist()

      // 履歴スナップショット: 復元中は積まない、タイピング等の連続変更は
      // 500ms でひとまとめにする(1文字ずつ undo になるのを防ぐため)。
      if (isRestoring.value) return
      if (historyTimer) clearTimeout(historyTimer)
      historyTimer = setTimeout(() => {
        if (!project.value) return
        const snapshot = JSON.stringify(project.value)
        if (history.value[history.value.length - 1] === snapshot) return
        history.value.push(snapshot)
        if (history.value.length > MAX_HISTORY) history.value.shift()
        future.value = []
      }, 500)
    },
    { deep: true },
  )

  return {
    project,
    libraryCharacters,
    loaded,
    saveState,
    lastSavedAt,
    canUndo,
    canRedo,
    load,
    refreshLibrary,
    saveNow: persist,
    undo,
    redo,
  }
})
