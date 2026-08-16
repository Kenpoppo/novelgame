import type { Project } from '#shared/domain/project/types'

export interface GameSummary {
  id: string
  title: string
  updatedAt: string
}

/**
 * 「他のユーザーもプレイできる」ようにするための、サーバー側の永続化ポート。
 * Supabase実装が infrastructure/supabase/supabaseCloudProjectRepository.ts にある。
 * サーバールート(server/api/**)からのみ呼ばれる想定(クライアントから直接DBは叩かない)。
 */
export interface CloudProjectRepository {
  save(ownerId: string, project: Project, id: string | null): Promise<string>
  listMine(ownerId: string): Promise<GameSummary[]>
  listPublished(): Promise<GameSummary[]>
  loadForOwner(ownerId: string, id: string): Promise<Project | null>
  loadPublished(id: string): Promise<Project | null>
  setPublished(ownerId: string, id: string, published: boolean): Promise<void>
}
