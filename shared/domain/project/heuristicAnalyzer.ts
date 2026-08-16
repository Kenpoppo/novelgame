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

const NAME_ONLY_LINE = /^([^\s:：「」『』。、！？…〜を]{1,12})(?:[(（][^)）]*[)）])?$/
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
  // 区切り記号のみの行(___ / ⸻ / — / ― / ─ / ━ など)はビート化せず読み飛ばす。
  // 台本上のシーン区切りとして書かれていることが多く、そのままビートにすると
  // 「地の文としての区切り線」がゲーム画面に表示されてしまうため。
  // 単独の `⸻` や `—` も除外対象(1文字以上でOK)。
  const SEPARATOR_ONLY_LINE = /^[_＿⸻—―–\-−ｰー─━═\s]+$/
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .map((line) => (line.length > 0 && SEPARATOR_ONLY_LINE.test(line) ? '' : line))
  const beats: RawBeat[] = []

  /** 与えられた位置以降で最初の非空行の位置を返す。無ければ -1。 */
  const findNextNonEmpty = (from: number): number => {
    for (let j = from; j < lines.length; j++) {
      if (lines[j]) return j
    }
    return -1
  }

  /**
   * 位置 `start` から「」(または『』)で始まる引用を、閉じ記号が現れる行まで
   * 連結して1つのセリフとして取り出す。取り出せなければ null。
   */
  const consumeQuoteFrom = (start: number): { text: string; endIndex: number } | null => {
    const first = lines[start]
    if (!first) return null
    const openMatch = first.match(/^[「『](.*)$/)
    if (!openMatch) return null

    // 単一行で完結する場合
    const single = first.match(QUOTE_ONLY_LINE)
    if (single) return { text: single[1]!, endIndex: start }

    // 複数行に渡る「」 → 閉じ記号が現れるまで結合する
    const parts: string[] = [openMatch[1]!]
    for (let j = start + 1; j < lines.length; j++) {
      const l = lines[j]
      if (l === undefined) break
      const close = l.match(/^(.*)[」』]\s*$/)
      if (close) {
        parts.push(close[1]!)
        return { text: parts.filter((p) => p.length > 0).join('\n'), endIndex: j }
      }
      // 途中行は空行でも本文に含めない(段落分けとして扱う程度)
      if (l.length > 0) parts.push(l)
    }
    return null
  }

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

    // 1. 名前だけの行 + 次の非空行が「セリフ」(空行を跨いで良い)
    const nameOnlyMatch = line.match(NAME_ONLY_LINE)
    if (nameOnlyMatch) {
      const nextIdx = findNextNonEmpty(i + 1)
      if (nextIdx >= 0) {
        const quote = consumeQuoteFrom(nextIdx)
        if (quote) {
          const speaker = nameOnlyMatch[1]!
          beats.push({ speaker, text: quote.text })
          lastSpeaker = speaker
          i = quote.endIndex + 1
          continue
        }
      }
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
    //    複数行に渡る引用にも対応する(閉じ記号までを1つのセリフに結合)。
    if (lastSpeaker) {
      const quote = consumeQuoteFrom(i)
      if (quote) {
        beats.push({ speaker: lastSpeaker, text: quote.text })
        i = quote.endIndex + 1
        continue
      }
    }

    // 4. 話者を持たない引用(ナレーション中の声・ラジオの音声など)も
    //    複数行にまたがる場合は1つの地の文としてまとめる。
    const orphanQuote = consumeQuoteFrom(i)
    if (orphanQuote) {
      beats.push({ speaker: null, text: orphanQuote.text })
      i = orphanQuote.endIndex + 1
      continue
    }

    // 5. どれにも当てはまらない行は地の文
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
