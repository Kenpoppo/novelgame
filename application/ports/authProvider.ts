export interface AuthUser {
  id: string
  email: string | null
}

/**
 * クライアント側の「今誰がログインしているか」の参照ポート。
 * Supabase実装が infrastructure/supabase/supabaseAuthProvider.ts にある。
 */
export interface AuthProvider {
  getCurrentUser(): AuthUser | null
}
