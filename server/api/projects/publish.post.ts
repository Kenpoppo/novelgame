import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import { publishProject } from '../../../application/useCases/publishProject'
import { createSupabaseAssetStorage } from '../../../infrastructure/supabase/supabaseAssetStorage'
import { createSupabaseCloudProjectRepository } from '../../../infrastructure/supabase/supabaseCloudProjectRepository'
import type { Project } from '#shared/domain/project/types'

/**
 * 公開する(要ログイン)。バリデーション → 埋め込み画像/音源のアップロード →
 * 保存 → 公開フラグON、をまとめて行う。既存作品の再公開は body.id を渡す。
 */
export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, statusMessage: 'ログインが必要です' })

  const body = await readBody<{ project: Project; id?: string }>(event)
  const client = await serverSupabaseClient(event)
  const assetStorage = createSupabaseAssetStorage(client)
  const cloudRepository = createSupabaseCloudProjectRepository(client)

  const result = await publishProject(user.id, body.project, body.id ?? null, assetStorage, cloudRepository)

  if (!result.ok) {
    throw createError({ statusCode: 422, statusMessage: '公開できません', data: { errors: result.errors } })
  }

  return { id: result.id }
})
