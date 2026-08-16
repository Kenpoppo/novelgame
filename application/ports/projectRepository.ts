import type { CharacterAsset, Project } from '#shared/domain/project/types'

/**
 * 「編集中の1プロジェクト」の永続化。ローカル(IndexedDB)実装が
 * infrastructure/local/indexedDbProjectRepository.ts にある。
 */
export interface ProjectRepository {
  getCurrentProject(): Promise<Project | null>
  saveCurrentProject(project: Project): Promise<void>

  listLibraryCharacters(): Promise<CharacterAsset[]>
  saveLibraryCharacter(character: CharacterAsset): Promise<void>
  deleteLibraryCharacter(id: string): Promise<void>
}
