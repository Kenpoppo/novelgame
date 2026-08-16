/**
 * 公開時、Project内に埋め込まれた data URL(キャラ画像・音源)を
 * 実ファイルとしてアップロードし、URLを返す。
 * Supabase実装が infrastructure/supabase/supabaseAssetStorage.ts にある。
 */
export interface AssetStorage {
  upload(ownerId: string, dataUrl: string, pathHint: string): Promise<string>
}
