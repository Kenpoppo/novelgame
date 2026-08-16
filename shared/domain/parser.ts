import { resolveLabels } from './labels'
import type { CharacterDef, Instruction, ParsedScript } from './types'

/**
 * 独自の簡易スクリプト形式を解析する。
 *
 * # コメント
 * @char id 表示名 [色]   キャラクター登録
 * *label名               ラベル定義(ジャンプ先)
 * -> label名              ラベルへジャンプ
 * id: セリフ              登録済みキャラクターの発言
 * 地の文                  上記に当てはまらない行はナレーションとして表示
 * ?                       選択肢ブロックの開始
 * > 選択肢テキスト -> label名   選択肢(直後に連続する `>` 行がまとめて1ブロックになる)
 */
export function parseScript(source: string): ParsedScript {
  const characters: Record<string, CharacterDef> = {}
  const items: (Instruction | { type: 'label'; name: string })[] = []

  const lines = source.split(/\r?\n/)
  let i = 0

  while (i < lines.length) {
    const line = lines[i]!.trim()
    i++

    if (line === '' || line.startsWith('#')) continue

    if (line.startsWith('@char ')) {
      const [id, name, color] = line.slice('@char '.length).trim().split(/\s+/)
      if (!id || !name) continue
      characters[id] = { id, name, color }
      continue
    }

    if (line.startsWith('*')) {
      items.push({ type: 'label', name: line.slice(1).trim() })
      continue
    }

    if (line.startsWith('->')) {
      items.push({ type: 'jump', target: line.slice(2).trim() })
      continue
    }

    if (line === '?') {
      const options: { text: string; target: string }[] = []
      // 選択肢は `?` の直後に連続する `>` 行としてまとめて読み取る
      while (i < lines.length && lines[i]!.trim().startsWith('>')) {
        const optionLine = lines[i]!.trim().slice(1).trim()
        i++
        const arrowIndex = optionLine.lastIndexOf('->')
        if (arrowIndex === -1) {
          throw new Error(`選択肢に飛び先が指定されていません: "${optionLine}"`)
        }
        options.push({
          text: optionLine.slice(0, arrowIndex).trim(),
          target: optionLine.slice(arrowIndex + 2).trim(),
        })
      }
      if (options.length === 0) {
        throw new Error('選択肢ブロックに選択肢がありません')
      }
      items.push({ type: 'choice', options })
      continue
    }

    const colonIndex = line.indexOf(':')
    if (colonIndex !== -1) {
      const id = line.slice(0, colonIndex).trim()
      if (characters[id]) {
        items.push({
          type: 'dialogue',
          speaker: id,
          text: line.slice(colonIndex + 1).trim(),
        })
        continue
      }
    }

    items.push({ type: 'dialogue', speaker: null, text: line })
  }

  const { instructions, labels } = resolveLabels(items)
  return { instructions, labels, characters }
}
