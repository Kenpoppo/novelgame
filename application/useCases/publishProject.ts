import { compileProject } from '#shared/domain/project/compile'
import type { Project } from '#shared/domain/project/types'
import type { AssetStorage } from '../ports/assetStorage'
import type { CloudProjectRepository } from '../ports/cloudProjectRepository'

export type PublishResult = { ok: true; id: string } | { ok: false; errors: string[] }

/**
 * 公開の流れ: バリデーション → 埋め込み画像/音源(data URL)を実ファイルへ
 * アップロードして参照を差し替え → 保存 → 公開フラグを立てる。
 * ローカル(IndexedDB)のプロジェクトはそのままでは他ユーザーに見えないため、
 * 公開時にここで初めて「材質化」する。
 */
export async function publishProject(
  ownerId: string,
  project: Project,
  existingId: string | null,
  assetStorage: AssetStorage,
  cloudRepository: CloudProjectRepository,
): Promise<PublishResult> {
  const compiled = compileProject(project)
  if (!compiled.ok) {
    return { ok: false, errors: compiled.errors }
  }

  const materialized: Project = {
    ...project,
    characters: await Promise.all(
      project.characters.map(async (character) => {
        let next = character
        if (character.imageDataUrl?.startsWith('data:')) {
          const url = await assetStorage.upload(ownerId, character.imageDataUrl, `characters/${character.id}`)
          next = { ...next, imageDataUrl: url }
        }
        if (character.imageAltDataUrl?.startsWith('data:')) {
          const url = await assetStorage.upload(ownerId, character.imageAltDataUrl, `characters/${character.id}-alt`)
          next = { ...next, imageAltDataUrl: url }
        }
        if (character.voiceDataUrl?.startsWith('data:')) {
          const url = await assetStorage.upload(ownerId, character.voiceDataUrl, `characters/${character.id}-voice`)
          next = { ...next, voiceDataUrl: url }
        }
        return next
      }),
    ),
    audio: await Promise.all(
      project.audio.map(async (cue) => {
        if (!cue.fileDataUrl?.startsWith('data:')) return cue
        const url = await assetStorage.upload(ownerId, cue.fileDataUrl, `audio/${cue.id}`)
        return { ...cue, fileDataUrl: url }
      }),
    ),
    backgrounds: await Promise.all(
      (project.backgrounds ?? []).map(async (bg) => {
        if (!bg.imageDataUrl?.startsWith('data:')) return bg
        const url = await assetStorage.upload(ownerId, bg.imageDataUrl, `backgrounds/${bg.id}`)
        return { ...bg, imageDataUrl: url }
      }),
    ),
  }

  const id = await cloudRepository.save(ownerId, materialized, existingId)
  await cloudRepository.setPublished(ownerId, id, true)
  return { ok: true, id }
}
