import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { z } from 'zod'

const ScriptAnalysisSchema = z.object({
  title: z.string().nullable(),
  characters: z.array(
    z.object({
      name: z.string(),
      color: z.string().nullable().describe('演出用のHEXカラーコード(例: #4fc3f7)。適当な色を提案してよい'),
    }),
  ),
  beats: z.array(
    z.object({
      speaker: z.string().nullable().describe('発言したキャラクター名。地の文なら null'),
      text: z.string(),
    }),
  ),
})

export type ServerScriptAnalysis = z.infer<typeof ScriptAnalysisSchema>

/**
 * 台本テキストをAI(Claude)で解析し、タイトル・キャラクター・セリフ/地の文の
 * ビート列を抽出する。ANTHROPIC_API_KEY が未設定の場合はこの機能自体が使えず、
 * クライアント側でヒューリスティック解析にフォールバックする設計
 * (Supabase連携と同じ「未設定でもアプリ全体は壊れない」方針)。
 */
export default defineEventHandler(async (event) => {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return { ok: false as const, reason: 'ai-unavailable' as const }
  }

  const body = await readBody<{ text?: string }>(event)
  const text = body.text?.trim()
  if (!text) {
    throw createError({ statusCode: 400, statusMessage: 'テキストが空です' })
  }

  const client = new Anthropic({ apiKey })

  try {
    const response = await client.messages.parse({
      model: 'claude-opus-5',
      max_tokens: 16000,
      system:
        'あなたはノベルゲームの台本解析アシスタントです。渡された台本テキストから、' +
        'タイトル(推測できなければnull)・登場キャラクター(名前と、識別しやすいHEXカラーの提案)・' +
        '発言順の台詞/地の文のビート列(話者名、または地の文ならnull)を抽出してください。' +
        '選択肢や分岐構造は無視し、直線的な会話の流れとして抽出してください。' +
        'テキストに書かれている内容だけを抽出し、存在しない設定を創作しないでください。',
      messages: [{ role: 'user', content: text }],
      output_config: { format: zodOutputFormat(ScriptAnalysisSchema) },
    })

    if (!response.parsed_output) {
      return { ok: false as const, reason: 'parse-failed' as const }
    }

    return { ok: true as const, analysis: response.parsed_output }
  } catch {
    return { ok: false as const, reason: 'error' as const }
  }
})
