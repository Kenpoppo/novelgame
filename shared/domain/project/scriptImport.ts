import type { Instruction, ParsedScript } from '../types'
import { createId } from './types'
import type { Beat, CharacterAsset } from './types'
import type { ProfileEntry } from './profileImport'

const PALETTE = ['#4fc3f7', '#f48fb1', '#aed581', '#ffb74d', '#ba68c8', '#4db6ac', '#7986cb', '#ff8a65']

/**
 * 台本解析の共通結果形式。AI解析・ヒューリスティック解析・自前テキストDSLの
 * どの経路から来た結果も、最終的にこの形へ正規化してから Project へ変換する。
 */
export interface ScriptAnalysis {
  title?: string
  characters: { name: string; color?: string }[]
  beats: { speaker: string | null; text: string }[]
}

/** ScriptAnalysis を Project にマージできる断片(新しいid採番済み)に変換する。 */
export function analysisToProjectFragments(analysis: ScriptAnalysis): {
  title?: string
  characters: CharacterAsset[]
  beats: Beat[]
} {
  const characters: CharacterAsset[] = analysis.characters.map((character, index) => ({
    id: createId(),
    name: character.name,
    color: character.color ?? PALETTE[index % PALETTE.length],
  }))
  const idByName = new Map(characters.map((character) => [character.name, character.id]))

  const beats: Beat[] = analysis.beats.map((beat) => ({
    id: createId(),
    type: 'dialogue',
    characterId: beat.speaker ? (idByName.get(beat.speaker) ?? null) : null,
    text: beat.text,
  }))

  return { title: analysis.title, characters, beats }
}

/**
 * 自前のテキスト台本DSL(parseScript())の結果を ScriptAnalysis へ正規化する。
 * 貼り付けられたテキストが偶然この形式に沿っている場合、AI/ヒューリスティックを
 * 経由せずそのまま高精度に取り込める。
 */
export function dslResultToAnalysis(parsed: ParsedScript): ScriptAnalysis {
  const nameById = new Map(Object.values(parsed.characters).map((character) => [character.id, character.name]))

  return {
    characters: Object.values(parsed.characters).map((character) => ({
      name: character.name,
      color: character.color,
    })),
    beats: parsed.instructions
      .filter((instruction): instruction is Extract<Instruction, { type: 'dialogue' }> => instruction.type === 'dialogue')
      .map((instruction) => ({
        speaker: instruction.speaker ? (nameById.get(instruction.speaker) ?? null) : null,
        text: instruction.text,
      })),
  }
}

/**
 * AIが使えない場合のフォールバック解析。実体は heuristicAnalyzer.ts の
 * ルールベース解析ライブラリ(複数の書式パターンを頻度フィルタ付きで検出する)。
 */
export { analyzeScriptHeuristically } from './heuristicAnalyzer'

/**
 * 「台本+登場人物リスト」が同一ファイルに混在している場合に、プロフィール解析を
 * かける対象範囲を切り出す。
 *
 * - 本文にセリフ「」が含まれない → 全文をプロフィールとして解析する
 *   (「登場人物.txt」のような純粋なプロフィール一覧ファイル)
 * - 本文にセリフ「」が含まれる  → `【登場人物】` などの見出しから、
 *   次の見出し・長い区切り線・本編の始まりまでを抽出する。
 *   見出しが無ければ空文字を返し、プロフィール解析はスキップさせる
 *   (誤検出で「セリフごとに1人のキャラ」が生まれるのを防ぐ)。
 *
 * 「本編突入」の判定は、行全体が「」(または『』)だけで構成されている場合
 * (=会話文そのもの)、または「名前「セリフ」」のように名前の直後にセリフが
 * 続く場合に限定する。以前は行の一部にでも「」が含まれていれば本編突入と
 * みなしていたが、これだと「「街角ヴィーナス」のパーソナリティ」のように
 * 番組名等を「」で参照しているだけの人物紹介文にも誤反応し、本来まだ続く
 * はずの登場人物リストを途中で打ち切ってしまう不具合があった
 * (実サンプルで16人中8人しか抽出できていなかった。詳細はdecisions.md参照)。
 */
const PROFILE_SECTION_HEADER = /^【\s*(?:登場人物|登場キャラクター|キャラクター|キャスト|CAST|人物紹介|人物設定)\s*】$/i
const CHAPTER_HEADER = /^【[^【】]+】$/
// 行全体がセリフだけの行(地の文中の引用ではなく、会話文そのものとみなせる)
const WHOLE_LINE_QUOTE = /^[「『].{1,200}[」』]$/
// 「名前「セリフ」」のように、名前の直後がそのままセリフで終わる同一行パターン
const NAME_QUOTE_LINE = /^[^\s「『]{1,12}[「『].{1,200}[」』]$/

function isDialogueLine(line: string): boolean {
  return WHOLE_LINE_QUOTE.test(line) || NAME_QUOTE_LINE.test(line)
}

interface ProfileSectionRange {
  /** 見出し行(【登場人物】等)自体の行番号 */
  headerLine: number
  /** 抽出範囲の開始行(見出しの次の行) */
  start: number
  /** 抽出範囲の終了行(この行の直前まで、exclusive) */
  end: number
}

/** 【登場人物】等の見出しを探し、そこから本編突入とみなせる行までの範囲を返す。 */
function findProfileSectionRange(lines: string[]): ProfileSectionRange | null {
  let headerLine = -1
  for (let i = 0; i < lines.length; i++) {
    if (PROFILE_SECTION_HEADER.test(lines[i]!.trim())) {
      headerLine = i
      break
    }
  }
  if (headerLine < 0) return null

  const start = headerLine + 1
  let end = lines.length
  let stopReason = 'end-of-text'
  for (let i = start; i < lines.length; i++) {
    const line = lines[i]!.trim()
    if (CHAPTER_HEADER.test(line) && !PROFILE_SECTION_HEADER.test(line)) {
      end = i
      stopReason = `次の見出し「${line}」`
      break
    }
    // ___ / ⸻⸻ などの長い区切り線でも切る
    if (/^_{2,}$/.test(line) || /^[⸻—―–]{2,}$/.test(line)) {
      end = i
      stopReason = '区切り線'
      break
    }
    // 行全体がセリフ(またはそれに準ずる形)の場合のみ本編突入とみなす
    if (isDialogueLine(line)) {
      end = i
      stopReason = `セリフ行「${line.slice(0, 30)}」`
      break
    }
  }
  console.debug(
    `[findProfileSectionRange] 見出し行=${headerLine}, 抽出範囲=${start}〜${end - 1}行目(全${lines.length}行中), 終了理由=${stopReason}`,
  )
  return { headerLine, start, end }
}

export function extractProfileSection(text: string): string {
  const hasDialogueQuotes = /[「『][^\n「『]{1,80}[」』]/.test(text)
  if (!hasDialogueQuotes) {
    console.debug('[extractProfileSection] セリフらしき「」が本文に無いため、全文をプロフィールとして扱う')
    return text
  }

  const lines = text.split(/\r?\n/)
  const range = findProfileSectionRange(lines)
  if (!range) {
    console.debug('[extractProfileSection] 【登場人物】等の見出しが見つからなかったため、プロフィール解析をスキップする')
    return ''
  }
  return lines.slice(range.start, range.end).join('\n')
}

/**
 * 台本本文から「登場人物紹介」セクション(見出し行を含む)を取り除いたテキストを
 * 返す。台本読み込み時のビート(セリフ・ナレーション)検出はこちらにかける
 * ことで、人物紹介の文章がストーリーへ大量のナレーションビートとして
 * 混入するのを防ぐ(詳細設定のストーリー編集画面が埋まってしまい邪魔になる、
 * プレイ中に人物紹介を1行ずつ送る必要が生じる、といった問題があったため)。
 * 見出しが見つからなければ(＝混在していなければ)そのまま返す。
 */
export function removeProfileSection(text: string): string {
  const hasDialogueQuotes = /[「『][^\n「『]{1,80}[」』]/.test(text)
  // セリフが無い(＝全文がプロフィールそのもの)場合、本編は存在しない
  if (!hasDialogueQuotes) return ''

  const lines = text.split(/\r?\n/)
  const range = findProfileSectionRange(lines)
  if (!range) return text

  return [...lines.slice(0, range.headerLine), ...lines.slice(range.end)].join('\n')
}

/**
 * 前方一致による「同一人物らしさ」の距離を返す(一致しなければnull)。
 * 「ゆうき」⊂「ゆうき警部」のような敬称・役職の付加は同一人物とみなすが、
 * 「はるな」⊂「はるなの父」のように「の」で続く場合は**別人**(「〜の父」
 * 「〜の妹」等、関係性を表す別キャラクターの名前)とみなし、マッチさせない。
 * これが無いと、短い方の文字数差だけを見て「はるな」(本人)が
 * 「はるなの父」(別人)に誤ってマッチしてしまう。
 */
function fuzzyNameDiff(a: string, b: string): number | null {
  if (b.startsWith(a) && !b.slice(a.length).startsWith('の')) return b.length - a.length
  if (a.startsWith(b) && !a.slice(b.length).startsWith('の')) return a.length - b.length
  return null
}

/**
 * 台本解析で検出したキャラクター一覧に、別途プロフィール解析で得た人物設定を
 * マージする。同一台本ファイルの中に「登場人物リスト」+「本編セリフ」が混在
 * している場合に、両方の情報(名前+notes+セリフ)を1つのキャラに集約する。
 *
 * マッチング規則:
 *   - 1st pass: 完全一致(「ゆうき」==「ゆうき」)を全キャラ分先に確定させる。
 *   - 2nd pass: 前方一致(4文字以内の差、「ゆうき」⊂「ゆうき警部」)。
 *     文字数差が最小の組み合わせから優先的に確定させる
 *     (「の」で続く関係性由来の別人は除外する。`fuzzyNameDiff()`参照)。
 *   - どちらにも合致しないプロフィールは、新規キャラとして追加する。
 *
 * 1st/2nd を分けているのは、「ゆう」「ゆうき」のように前方一致が連鎖する
 * 短い名前が混在すると、単純な先頭からの逐次マッチでは「ゆう」が先に
 * 「ゆうき警部」を(本来の完全一致相手である「ゆう」より先に)横取りして
 * しまい、玉突きで「ゆうき」が無関係な「ゆう」のプロフィールと誤って
 * マッチしてしまう事故が実際に起きたため
 * (詳細は decisions.md の該当エントリを参照)。
 */
export function mergeProfilesIntoCharacters(
  scriptCharacters: CharacterAsset[],
  profiles: ProfileEntry[],
): CharacterAsset[] {
  if (profiles.length === 0) return scriptCharacters

  const merged = scriptCharacters.map((c) => ({ ...c }))
  const usedProfiles = new Set<number>()
  const matchedChar = new Set<number>()
  const matchLog: { 台本キャラ: string; マッチしたプロフィール: string }[] = new Array(merged.length)

  const applyMatch = (charIndex: number, profileIndex: number): void => {
    usedProfiles.add(profileIndex)
    matchedChar.add(charIndex)
    const c = merged[charIndex]!
    const p = profiles[profileIndex]!
    matchLog[charIndex] = { 台本キャラ: c.name, マッチしたプロフィール: p.name }
    c.notes = p.notes ?? c.notes
    c.color = c.color ?? p.color
  }

  // 1st pass: 完全一致を全キャラ分先に確定させる
  merged.forEach((c, charIndex) => {
    const exactIndex = profiles.findIndex((p, i) => !usedProfiles.has(i) && p.name === c.name)
    if (exactIndex >= 0) applyMatch(charIndex, exactIndex)
  })

  // 2nd pass: 前方一致(4文字差以内)。すべての候補ペアを文字数差の昇順で
  // 並べ、差が小さい(=より確からしい)組み合わせから確定させる。
  const candidates: { charIndex: number; profileIndex: number; diff: number }[] = []
  merged.forEach((c, charIndex) => {
    if (matchedChar.has(charIndex)) return
    profiles.forEach((p, profileIndex) => {
      if (usedProfiles.has(profileIndex)) return
      const diff = fuzzyNameDiff(c.name, p.name)
      if (diff !== null && diff <= 4) candidates.push({ charIndex, profileIndex, diff })
    })
  })
  candidates.sort((a, b) => a.diff - b.diff)
  for (const candidate of candidates) {
    if (matchedChar.has(candidate.charIndex) || usedProfiles.has(candidate.profileIndex)) continue
    applyMatch(candidate.charIndex, candidate.profileIndex)
  }

  merged.forEach((c, charIndex) => {
    if (!matchLog[charIndex]) matchLog[charIndex] = { 台本キャラ: c.name, マッチしたプロフィール: '(無し)' }
  })

  // プロフィールにしか登場しないキャラは新規追加(セリフはまだ無いが登録しておく)
  const addedOnly: string[] = []
  for (const [i, p] of profiles.entries()) {
    if (usedProfiles.has(i)) continue
    addedOnly.push(p.name)
    merged.push({
      id: createId(),
      name: p.name,
      color: p.color ?? PALETTE[merged.length % PALETTE.length],
      notes: p.notes,
    })
  }

  console.debug(
    `[mergeProfilesIntoCharacters] 台本キャラ${scriptCharacters.length}人 + プロフィール${profiles.length}人 → 統合後${merged.length}人` +
      `(notes補完${matchedChar.size}件 / プロフィールのみ新規追加${addedOnly.length}件)`,
  )
  if (matchLog.length > 0) console.table(matchLog)
  if (addedOnly.length > 0) console.debug('[mergeProfilesIntoCharacters] プロフィールのみ新規追加:', addedOnly.join(', '))

  return merged
}
