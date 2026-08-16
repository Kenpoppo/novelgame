import type { ScriptAnalysis } from './scriptImport'

/**
 * AIやテキストDSLに頼らず、様々な書式のテキスト台本から話者とセリフを検出する
 * ルールベース解析ライブラリ。アップロードされる台本の書式は投稿者によって
 * バラバラなため、複数の検出パターンを優先順位付きで併用し、誤検出は
 * 出現頻度でふるい落とす方針をとる。
 *
 * 対応パターン:
 *   1. 名前だけの行 + 次の行が「セリフ」の2行構成(実際の台本で最も多い形式)
 *   2. 同一行の「名前: セリフ」「名前「セリフ」」
 *   3. 名前の再掲がなく「セリフ」だけが連続する行(直前の話者の続きとみなす)
 *   4. 上記いずれにも当てはまらない行は地の文として扱う
 *
 * 精度対策(実サンプルでの検証結果を踏まえたもの):
 *   - 敬称・役職の名寄せ: 「たかし」と「たかし刑事」のように同一人物が
 *     複数の表記で登場するのを1人にまとめる(名寄せ後にまとめて頻度を数える
 *     ため、単独では1回しか登場しない表記でも合算で生き残りやすくなる)。
 *   - 頻度フィルタ: 名寄せ後も2回以上出現しない名前は誤検出(見出しや
 *     章タイトルの誤検出であることが多い)とみなし地の文へ格下げする。
 *   - 集団ラベル除外: 「全員」「みんな」「一同」等は個人を指さない指示語
 *     なのでキャラクターとして扱わず、その行はナレーションへ格下げする。
 */

const NAME_ONLY_LINE = /^([^\s:：「」『』。、！？…〜]{1,12})(?:[(（][^)）]*[)）])?$/
const SAME_LINE_COLON = /^([^\s:：]{1,12})[:：]\s*(.+)$/
const SAME_LINE_QUOTE = /^([^\s「『]{1,12})[「『](.+)[」』]$/
const QUOTE_ONLY_LINE = /^[「『](.+)[」』]$/

// 敬称・呼称・よくある役職の接尾辞。長いものから優先的に判定する。
const NAME_SUFFIXES = [
  '先輩', '先生', '教授', '博士', '刑事', '警部補', '警部', '巡査',
  '部長', '課長', '係長', '局長', '隊長', '社長', '店長', '会長',
  '探偵', '監督', '議員', '大臣', '選手', '記者',
  'さん', 'くん', '君', 'ちゃん', '様', '氏',
].sort((a, b) => b.length - a.length)

// 個人を指さない集団・役割ラベル。これらの語が「名前だけの行」パターン等で
// 発話者として検出されてもキャラクター一覧には登録せず、当該行はナレーション
// (speaker: null)として扱う(「全員」「みんな」等はキャラクターではなく
// 「その場の登場人物全員のセリフ」を示す指示語のため)。
const NON_PERSON_LABELS = new Set<string>([
  '全員', 'みんな', '皆', '皆さん', 'みなさん', '一同', '両者', '双方',
  '一人', '二人', '三人', '四人', '五人', '六人', '七人', '八人', '九人', '十人',
  '観客', '群衆', 'モブ', 'その他', '客',
  'ナレーション', 'ナレーター', 'モノローグ', '独白', '地の文',
])

interface RawBeat {
  speaker: string | null
  text: string
}

/** 敬称・役職の接尾辞を外し、既知の話者名と一致すればその正式名を返す。 */
function resolveCanonicalName(name: string, knownNames: ReadonlySet<string>): string {
  let current = name
  while (true) {
    const suffix = NAME_SUFFIXES.find((s) => current.length > s.length && current.endsWith(s))
    if (!suffix) return name

    const stripped = current.slice(0, -suffix.length)
    if (stripped !== name && knownNames.has(stripped)) return stripped
    current = stripped
  }
}

export function analyzeScriptHeuristically(text: string): ScriptAnalysis {
  const lines = text.split(/\r?\n/).map((line) => line.trim())
  const beats: RawBeat[] = []

  let lastSpeaker: string | null = null
  let i = 0
  while (i < lines.length) {
    const line = lines[i]!

    if (!line) {
      // 空行(段落区切り)を挟んだら「セリフだけの続き行」の話者引き継ぎを止める
      lastSpeaker = null
      i++
      continue
    }

    // 1. 名前だけの行 + 次の非空行が「セリフ」
    const nameOnlyMatch = line.match(NAME_ONLY_LINE)
    const nextLine = lines[i + 1]
    const nextQuoteMatch = nextLine ? nextLine.match(QUOTE_ONLY_LINE) : null
    if (nameOnlyMatch && nextQuoteMatch) {
      const speaker = nameOnlyMatch[1]!
      beats.push({ speaker, text: nextQuoteMatch[1]! })
      lastSpeaker = speaker
      i += 2
      continue
    }

    // 2. 同一行「名前: セリフ」「名前「セリフ」」
    const sameLineMatch = line.match(SAME_LINE_COLON) ?? line.match(SAME_LINE_QUOTE)
    if (sameLineMatch) {
      const speaker = sameLineMatch[1]!
      beats.push({ speaker, text: sameLineMatch[2]! })
      lastSpeaker = speaker
      i++
      continue
    }

    // 3. 名前の再掲なしで続く「セリフ」だけの行 → 直前の話者の続き
    const quoteOnlyMatch = line.match(QUOTE_ONLY_LINE)
    if (lastSpeaker && quoteOnlyMatch) {
      beats.push({ speaker: lastSpeaker, text: quoteOnlyMatch[1]! })
      i++
      continue
    }

    // 4. どれにも当てはまらない行は地の文
    beats.push({ speaker: null, text: line })
    i++
  }

  // 名寄せ: 敬称・役職違いの表記ゆれを1人にまとめる
  const rawNames = new Set(beats.filter((b) => b.speaker !== null).map((b) => b.speaker!))
  const canonicalByRawName = new Map(Array.from(rawNames).map((name) => [name, resolveCanonicalName(name, rawNames)]))

  const speakerCounts = new Map<string, number>()
  for (const beat of beats) {
    if (!beat.speaker) continue
    const canonical = canonicalByRawName.get(beat.speaker)!
    speakerCounts.set(canonical, (speakerCounts.get(canonical) ?? 0) + 1)
  }

  // 頻度フィルタ + 集団ラベル除外: 名寄せ後も2回以上出現しない名前は誤検出
  // (見出しや章タイトルなど)とみなし地の文へ格下げする。個人を指さない集団
  // ラベル(「全員」等)は出現回数に関わらずキャラクター扱いから外す。
  const finalBeats = beats.map((beat) => {
    if (!beat.speaker) return { speaker: null, text: beat.text }

    const canonical = canonicalByRawName.get(beat.speaker)!
    if (NON_PERSON_LABELS.has(canonical)) return { speaker: null, text: beat.text }
    const isReliable = (speakerCounts.get(canonical) ?? 0) >= 2
    return isReliable ? { speaker: canonical, text: beat.text } : { speaker: null, text: beat.text }
  })

  const characterNames = Array.from(new Set(finalBeats.filter((beat) => beat.speaker !== null).map((beat) => beat.speaker!)))

  return {
    characters: characterNames.map((name) => ({ name })),
    beats: finalBeats,
  }
}
