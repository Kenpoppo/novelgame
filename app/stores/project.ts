import { indexedDbProjectRepository } from '../../infrastructure/local/indexedDbProjectRepository'
import { createEmptyProject } from '#shared/domain/project/types'
import type { CharacterAsset, Project } from '#shared/domain/project/types'

export const useProjectStore = defineStore('project', () => {
  const project = ref<Project | null>(null)
  const libraryCharacters = ref<CharacterAsset[]>([])
  const loaded = ref(false)

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
    await indexedDbProjectRepository.saveCurrentProject(project.value)
  }

  async function refreshLibrary(): Promise<void> {
    libraryCharacters.value = await indexedDbProjectRepository.listLibraryCharacters()
  }

  watch(project, () => void persist(), { deep: true })

  return { project, libraryCharacters, loaded, load, refreshLibrary, saveNow: persist }
})
