import type { CharacterAsset, Project } from '#shared/domain/project/types'
import type { ProjectRepository } from '../../application/ports/projectRepository'

const DB_NAME = 'novelgame'
const DB_VERSION = 1
const PROJECT_STORE = 'project'
const CHARACTER_LIBRARY_STORE = 'characterLibrary'
const CURRENT_PROJECT_KEY = 'current'

/**
 * Vue の reactive Proxy は IndexedDB の structured clone に失敗する
 * (`DataCloneError`)。保存前にプレーンオブジェクトへ変換する。
 */
function toPlain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(PROJECT_STORE)) {
        db.createObjectStore(PROJECT_STORE)
      }
      if (!db.objectStoreNames.contains(CHARACTER_LIBRARY_STORE)) {
        db.createObjectStore(CHARACTER_LIBRARY_STORE, { keyPath: 'id' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export const indexedDbProjectRepository: ProjectRepository = {
  async getCurrentProject(): Promise<Project | null> {
    const db = await openDb()
    const tx = db.transaction(PROJECT_STORE, 'readonly')
    const result = await requestToPromise(tx.objectStore(PROJECT_STORE).get(CURRENT_PROJECT_KEY))
    return (result as Project | undefined) ?? null
  },

  async saveCurrentProject(project: Project): Promise<void> {
    const db = await openDb()
    const tx = db.transaction(PROJECT_STORE, 'readwrite')
    await requestToPromise(tx.objectStore(PROJECT_STORE).put(toPlain(project), CURRENT_PROJECT_KEY))
  },

  async listLibraryCharacters(): Promise<CharacterAsset[]> {
    const db = await openDb()
    const tx = db.transaction(CHARACTER_LIBRARY_STORE, 'readonly')
    return requestToPromise(tx.objectStore(CHARACTER_LIBRARY_STORE).getAll())
  },

  async saveLibraryCharacter(character: CharacterAsset): Promise<void> {
    const db = await openDb()
    const tx = db.transaction(CHARACTER_LIBRARY_STORE, 'readwrite')
    await requestToPromise(tx.objectStore(CHARACTER_LIBRARY_STORE).put(toPlain(character)))
  },

  async deleteLibraryCharacter(id: string): Promise<void> {
    const db = await openDb()
    const tx = db.transaction(CHARACTER_LIBRARY_STORE, 'readwrite')
    await requestToPromise(tx.objectStore(CHARACTER_LIBRARY_STORE).delete(id))
  },
}
