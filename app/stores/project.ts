import { indexedDbProjectRepository } from '../../infrastructure/local/indexedDbProjectRepository'
import { createEmptyProject } from '#shared/domain/project/types'
import type { CharacterAsset, Project } from '#shared/domain/project/types'

export const useProjectStore = defineStore('project', () => {
  const project = ref<Project | null>(null)
  const libraryCharacters = ref<CharacterAsset[]>([])
  const loaded = ref(false)
  // 自動保存の状態: idle=待機/saving=保存中/saved=直近で保存完了
  const saveState = ref<'idle' | 'saving' | 'saved'>('idle')
  const lastSavedAt = ref<Date | null>(null)

  async function load(): Promise<void> {
    if (loaded.value) return
    const existing = await indexedDbProjectRepository.getCurrentProject()
    project.value = existing ?? createEmptyProject()
    if (!existing && project.value) {
      await indexedDbProjectRepository.saveCurrentProject(project.value)
    }
    libraryCharacters.value = await indexedDbProjectRepository.listLibraryCharacters()
    loaded.value = true
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

  async function refreshLibrary(): Promise<void> {
    libraryCharacters.value = await indexedDbProjectRepository.listLibraryCharacters()
  }

  watch(project, () => void persist(), { deep: true })

  return { project, libraryCharacters, loaded, saveState, lastSavedAt, load, refreshLibrary, saveNow: persist }
})
