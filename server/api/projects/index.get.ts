import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import { createSupabaseCloudProjectRepository } from '../../../infrastructure/supabase/supabaseCloudProjectRepository'

/** 自分のプロジェクト一覧(要ログイン)。 */
export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, statusMessage: 'ログインが必要です' })

  const client = await serverSupabaseClient(event)
  const repository = createSupabaseCloudProjectRepository(client)
  const projects = await repository.listMine(user.id)
  return { projects }
})
