import { serverSupabaseClient } from '#supabase/server'
import { createSupabaseCloudProjectRepository } from '../../../infrastructure/supabase/supabaseCloudProjectRepository'

/** 公開作品を1件プレイ用に取得する(誰でも閲覧可)。 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'idが指定されていません' })

  const client = await serverSupabaseClient(event)
  const repository = createSupabaseCloudProjectRepository(client)

  const project = await repository.loadPublished(id).catch(() => null)
  if (!project) {
    throw createError({ statusCode: 404, statusMessage: '作品が見つかりません' })
  }

  return { project }
})
