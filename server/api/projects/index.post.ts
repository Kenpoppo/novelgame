import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import { createSupabaseCloudProjectRepository } from '../../../infrastructure/supabase/supabaseCloudProjectRepository'
import type { Project } from '#shared/domain/project/types'

/** 新規プロジェクトをクラウドに保存する(要ログイン)。下書き段階なのでバリデーションはしない。 */
export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, statusMessage: 'ログインが必要です' })

  const project = await readBody<Project>(event)
  const client = await serverSupabaseClient(event)
  const repository = createSupabaseCloudProjectRepository(client)
  const id = await repository.save(user.id, project, null)
  return { id }
})
