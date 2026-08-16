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

/**
 * デバッグ用: どのブロックが何の理由でスキップされたかを追跡する。
 * ブラウザ実行結果とNode実行結果が食い違ったときに、実際にパーサーが
 * どのように動いたかをコンソールで確認するために使う。
 */
export interface ProfileParseDiagnostics {
  entries: ProfileEntry[]
  skipped: { block: string; name: string; reason: string }[]
}

/** バンドルされている実装のバージョン識別子(HMR キャッシュ確認用)。 */
export const PROFILE_IMPORT_VERSION = '2026-08-17-line-based-split'

const KEY_NAME = /^(?:名前|Name)\s*[:：]\s*(.+)$/i
const KEY_COLOR = /^(?:色|Color)\s*[:：]\s*(#?[0-9a-f]{3,8})\s*$/i
const KEY_NOTES = /^(?:プロフィール|人物設定|説明|Profile|Description|Note|Notes)\s*[:：]\s*(.*)$/i
const INLINE_COLOR = /#[0-9a-f]{3,8}\b/i
const NAME_DECORATION = /^[【\[■◆●○▲△▼▽◇♦♢★☆・*\-]+\s*(.+?)\s*[】\]]*$/
// 句読点や記号を含まない短い行(=素の名前らしい行)。「ラジオ局」「職員」の
// ように役職/カテゴリの見出しが、空行を挟まず本当の名前の直前に書かれている
// ケースに対応するため使う(下記ループのコメント参照)。
const BARE_NAME_CANDIDATE = /^[^\s:：「」『』。、！？…〜]{1,12}$/

// 個人名として扱わない汎用語(章タイトル・組織名・役職名・集団ラベル)。
// 明示的に「名前:」キーが指定されていない場合のみ適用する
// (ユーザーが意図的に「職員」というキャラクターを登録することも許容するため)。
const NON_CHARACTER_TERMS = new Set<string>([
  // 章タイトル・キャスト一覧の見出しに使われる語
  '登場人物', '登場キャラクター', '登場キャラ', 'キャラクター一覧', 'キャラ一覧', 'キャラクター', 'キャラ',
  'キャスト', 'キャスト一覧', '主要人物', '主要キャラ', '主人公', 'サブキャラ', '準主要人物',
  '敵キャラ', '敵役', '味方キャラ',
  // 集団ラベル(heuristicAnalyzerのNON_PERSON_LABELSと同旨)
  '全員', 'みんな', '皆', '皆さん', 'みなさん', '一同', '両者', '双方',
  '一人', '二人', '三人', '四人', '五人', '六人', '七人', '八人', '九人', '十人',
  '観客', '群衆', 'モブ', 'その他', '客',
  'ナレーション', 'ナレーター', 'モノローグ', '独白', '地の文',
  // 組織・場所単体(名前+の+場所 のような合成語は除外しない)
  'ラジオ局', '警察', '警察本部', '警察署', '県警', '県警本部', '本部',
  '会社', '学校', '大学', '高校', '中学校', '中学', '小学校', '小学',
  '病院', '事務所', '家', '教室', '部屋', '店', '喫茶店', 'カフェ',
  // 職名単独(特定個人を指さない汎用役職)
  '職員', '社員', '従業員', 'スタッフ', '店員',
  'パーソナリティ', 'ラジオパーソナリティ', 'アナウンサー', 'キャスター', 'レポーター',
  '一般人', '通行人', '記者団',
])

function normalizeColor(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  const clean = raw.trim().toLowerCase()
  if (!clean) return undefined
  return clean.startsWith('#') ? clean : `#${clean}`
}

/**
 * 行単位で走査し、trim後に空になる行を「ブロック区切り」として扱う。
 * split(/\r?\n\s*\r?\n/) は環境やパターンによって挙動が揺れる場合が
 * あったため、より予測可能な単純ループ方式に置き換えている。
 */
function splitIntoBlocks(input: string): string[] {
  const rawLines = input.split(/\r?\n/)
  const blocks: string[] = []
  let current: string[] = []

  for (const rawLine of rawLines) {
    if (rawLine.trim().length === 0) {
      if (current.length > 0) {
        blocks.push(current.join('\n'))
        current = []
      }
      continue
    }
    current.push(rawLine)
  }
  if (current.length > 0) blocks.push(current.join('\n'))

  return blocks
}

/**
 * 与えられたテキストをキャラクタープロフィールのリストへ変換する。
 * JSON として解釈できるならまずそれを試し、失敗した場合は空行区切りブロックの
 * 自然文形式として解釈する。
 */
export function parseProfileText(input: string): ProfileEntry[] {
  return parseProfileTextWithDiagnostics(input).entries
}

export function parseProfileTextWithDiagnostics(input: string): ProfileParseDiagnostics {
  const trimmed = input.trim()
  if (!trimmed) return { entries: [], skipped: [] }

  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const parsed: unknown = JSON.parse(trimmed)
      const list: unknown[] = Array.isArray(parsed) ? parsed : [parsed]
      const entries = list
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
      return { entries, skipped: [] }
    } catch {
      // JSON として解釈できない場合は、下のテキスト解釈にフォールバック
    }
  }

  const blocks = splitIntoBlocks(trimmed)
  const entries: ProfileEntry[] = []
  const skipped: { block: string; name: string; reason: string }[] = []

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
      // 名前がまだ無い場合、または(説明文がまだ始まっておらず)この行も
      // 「素の名前らしい短い行」に見える場合は、名前候補をこの行で更新する。
      // 実サンプルで「ラジオパーソナリティ」(役職の見出し)の直後に
      // 空行を挟まず「DJヤチ」(本当の名前)が続く記法があり、旧実装では
      // 最初の行だけを名前として確定させていたため、2行目以降がすべて
      // 「ラジオパーソナリティ」の notes として吸収され、かつ
      // 「ラジオパーソナリティ」自体はNON_CHARACTER_TERMSに含まれるため
      // ブロックごと(=本来のDJヤチのプロフィールごと)捨てられていた。
      if (!name || (notesLines.length === 0 && BARE_NAME_CANDIDATE.test(line))) {
        const decoratedMatch = line.match(NAME_DECORATION)
        let candidate = (decoratedMatch?.[1] ?? line).trim()
        const inlineColor = candidate.match(INLINE_COLOR)
        if (inlineColor) {
          color = color ?? normalizeColor(inlineColor[0])
          candidate = candidate.replace(inlineColor[0], '').trim()
        }
        if (name && name !== candidate) {
          console.debug(`[parseProfileText] 名前候補を更新: 「${name}」→「${candidate}」(空行を挟まず短い行が連続したため)`)
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

    const blockSummary = block.split(/\r?\n/)[0]!.slice(0, 30)
    if (!name) {
      skipped.push({ block: blockSummary, name: '', reason: 'no-name-detected' })
      continue
    }
    if (!hasExplicitNameKey && notesLines.length === 0) {
      skipped.push({ block: blockSummary, name, reason: 'single-line-no-description' })
      continue
    }
    if (!hasExplicitNameKey && NON_CHARACTER_TERMS.has(name)) {
      skipped.push({ block: blockSummary, name, reason: 'non-character-term' })
      continue
    }

    entries.push({
      name,
      color,
      notes: notesLines.length > 0 ? notesLines.join('\n') : undefined,
    })
  }

  console.debug(
    `[parseProfileText] ${blocks.length}ブロック → 採用${entries.length}件 / スキップ${skipped.length}件` +
      (skipped.length > 0 ? `(理由内訳: ${summarizeSkipReasons(skipped)})` : ''),
  )

  return { entries, skipped }
}

function summarizeSkipReasons(skipped: { reason: string }[]): string {
  const counts = new Map<string, number>()
  for (const s of skipped) counts.set(s.reason, (counts.get(s.reason) ?? 0) + 1)
  return Array.from(counts.entries()).map(([reason, count]) => `${reason}×${count}`).join(', ')
}
