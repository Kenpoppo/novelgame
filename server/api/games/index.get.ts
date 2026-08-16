import { serverSupabaseClient } from '#supabase/server'
import { createSupabaseCloudProjectRepository } from '../../../infrastructure/supabase/supabaseCloudProjectRepository'

/** 公開作品一覧(誰でも閲覧可)。Supabase未接続時はエラーにせず空配列を返す。 */
export default defineEventHandler(async (event) => {
  try {
    const client = await serverSupabaseClient(event)
    const repository = createSupabaseCloudProjectRepository(client)
    const games = await repository.listPublished()
    return { games }
  } catch {
    return { games: [] }
  }
})
