import type { SupabaseClient } from '@supabase/supabase-js'
import type { AssetStorage } from '../../application/ports/assetStorage'

function dataUrlToBuffer(dataUrl: string): { data: Buffer; contentType: string } {
  const match = dataUrl.match(/^data:(.*?);base64,(.*)$/)
  if (!match) throw new Error('不正な data URL です')
  const [, contentType, base64] = match
  return { data: Buffer.from(base64!, 'base64'), contentType: contentType! }
}

export function createSupabaseAssetStorage(client: SupabaseClient): AssetStorage {
  return {
    async upload(ownerId, dataUrl, pathHint) {
      const { data, contentType } = dataUrlToBuffer(dataUrl)
      const bucket = contentType.startsWith('audio/') ? 'audio' : 'character-images'
      const path = `${ownerId}/${pathHint}-${Date.now()}`

      const { error } = await client.storage.from(bucket).upload(path, data, { contentType, upsert: true })
      if (error) throw error

      const { data: publicUrl } = client.storage.from(bucket).getPublicUrl(path)
      return publicUrl.publicUrl
    },
  }
}
