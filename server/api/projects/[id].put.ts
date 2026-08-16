import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import { createSupabaseCloudProjectRepository } from '../../../infrastructure/supabase/supabaseCloudProjectRepository'
import type { Project } from '#shared/domain/project/types'

/** 既存プロジェクトをクラウドに上書き保存する(要ログイン、本人の作品のみ)。 */
export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, statusMessage: 'ログインが必要です' })

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'idが指定されていません' })

  const project = await readBody<Project>(event)
  const client = await serverSupabaseClient(event)
  const repository = createSupabaseCloudProjectRepository(client)
  await repository.save(user.id, project, id)
  return { id }
})
