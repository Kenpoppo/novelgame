/**
 * キャラクタープロフィール(人物設定)テキストの一括読み込みパーサー。
 *
 * 実サンプルで見かける記法をなるべく飲み込めるように、柔軟に解釈する:
 *   - JSON 配列/オブジェクトを直接与える形式
 *   - 空行区切りブロックで、各ブロックの冒頭行を名前として扱う自然文形式
 *   - 「名前:」「色:」「説明:」などのキー行(全角/半角コロン、英日どちらも可)
 *   - 名前行は【】■◆●などの装飾記号や、行内の #RRGGBB 色指定を吸収する
 *
 * 名前が取れなかったブロックは無視する(誤検出を避けるため沈黙で捨てる)。
 */

export interface ProfileEntry {
  name: string
  color?: string
  notes?: string
}

const KEY_NAME = /^(?:名前|Name)\s*[:：]\s*(.+)$/i
const KEY_COLOR = /^(?:色|Color)\s*[:：]\s*(#?[0-9a-f]{3,8})\s*$/i
const KEY_NOTES = /^(?:プロフィール|人物設定|説明|Profile|Description|Note|Notes)\s*[:：]\s*(.*)$/i
const INLINE_COLOR = /#[0-9a-f]{3,8}\b/i
const NAME_DECORATION = /^[【\[■◆●○▲△▼▽◇♦♢★☆・*\-]+\s*(.+?)\s*[】\]]*$/

function normalizeColor(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  const clean = raw.trim().toLowerCase()
  if (!clean) return undefined
  return clean.startsWith('#') ? clean : `#${clean}`
}

/**
 * 与えられたテキストをキャラクタープロフィールのリストへ変換する。
 * JSON として解釈できるならまずそれを試し、失敗した場合は空行区切りブロックの
 * 自然文形式として解釈する。
 */
export function parseProfileText(input: string): ProfileEntry[] {
  const trimmed = input.trim()
  if (!trimmed) return []

  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const parsed: unknown = JSON.parse(trimmed)
      const list: unknown[] = Array.isArray(parsed) ? parsed : [parsed]
      return list
        .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
        .map((item) => {
          const name = String(item.name ?? item['名前'] ?? '').trim()
          const rawColor = (item.color ?? item['色']) as unknown
          const color = typeof rawColor === 'string' ? normalizeColor(rawColor) : undefined
          const rawNotes = (item.notes ?? item.description ?? item['説明'] ?? item['人物設定']) as unknown
          const notes = typeof rawNotes === 'string' && rawNotes.trim().length > 0 ? rawNotes.trim() : undefined
          return { name, color, notes }
        })
        .filter((entry) => entry.name.length > 0)
    } catch {
      // JSON として解釈できない場合は、下のテキスト解釈にフォールバック
    }
  }

  const blocks = trimmed.split(/\r?\n\s*\r?\n/)
  const entries: ProfileEntry[] = []

  for (const block of blocks) {
    const lines = block.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.length > 0)
    if (lines.length === 0) continue

    let name = ''
    let color: string | undefined
    let hasExplicitNameKey = false
    const notesLines: string[] = []

    for (const line of lines) {
      const nameKey = line.match(KEY_NAME)
      if (nameKey) {
        name = nameKey[1]!.trim()
        hasExplicitNameKey = true
        continue
      }
      const colorKey = line.match(KEY_COLOR)
      if (colorKey) {
        color = normalizeColor(colorKey[1])
        continue
      }
      const notesKey = line.match(KEY_NOTES)
      if (notesKey) {
        const rest = notesKey[1]!.trim()
        if (rest) notesLines.push(rest)
        continue
      }
      if (!name) {
        const decoratedMatch = line.match(NAME_DECORATION)
        let candidate = (decoratedMatch?.[1] ?? line).trim()
        const inlineColor = candidate.match(INLINE_COLOR)
        if (inlineColor) {
          color = color ?? normalizeColor(inlineColor[0])
          candidate = candidate.replace(inlineColor[0], '').trim()
        }
        name = candidate
        continue
      }
      const inlineColor = line.match(INLINE_COLOR)
      if (inlineColor && !color) {
        color = normalizeColor(inlineColor[0])
      }
      notesLines.push(line)
    }

    if (!name) continue
    // 「名前:」等の明示的キーがなく、かつ説明行も無い単独名前ブロックは
    // 章タイトルや組織名(例: 「県警本部」)である可能性が高いため、
    // キャラクターとしては登録しない。明示的キーがある場合はユーザーが
    // 意図的に名前だけを登録したとみなして残す。
    if (!hasExplicitNameKey && notesLines.length === 0) continue

    entries.push({
      name,
      color,
      notes: notesLines.length > 0 ? notesLines.join('\n') : undefined,
    })
  }

  return entries
}
