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
 * 台本解析で検出したキャラクター一覧に、別途プロフィール解析で得た人物設定を
 * マージする。同一台本ファイルの中に「登場人物リスト」+「本編セリフ」が混在
 * している場合に、両方の情報(名前+notes+セリフ)を1つのキャラに集約する。
 *
 * マッチング規則:
 *   - 完全一致: 「ゆうき」== 「ゆうき」
 *   - 前方一致(4文字以内の差): 「ゆうき」⊂「ゆうき警部」→ 同一人物とみなす
 *     (プロフィール側で肩書きあり、台本側で肩書きなしの正規化に対応)
 *   - どちらにも合致しないプロフィールは、新規キャラとして追加する
 */
export function mergeProfilesIntoCharacters(
  scriptCharacters: CharacterAsset[],
  profiles: ProfileEntry[],
): CharacterAsset[] {
  if (profiles.length === 0) return scriptCharacters

  const merged = scriptCharacters.map((c) => ({ ...c }))
  const usedProfiles = new Set<number>()

  for (const c of merged) {
    const matchIndex = profiles.findIndex((p, i) => {
      if (usedProfiles.has(i)) return false
      if (p.name === c.name) return true
      if (p.name.startsWith(c.name) && p.name.length - c.name.length <= 4) return true
      if (c.name.startsWith(p.name) && c.name.length - p.name.length <= 4) return true
      return false
    })
    if (matchIndex < 0) continue
    usedProfiles.add(matchIndex)
    const p = profiles[matchIndex]!
    c.notes = p.notes ?? c.notes
    c.color = c.color ?? p.color
  }

  // プロフィールにしか登場しないキャラは新規追加(セリフはまだ無いが登録しておく)
  for (const [i, p] of profiles.entries()) {
    if (usedProfiles.has(i)) continue
    merged.push({
      id: createId(),
      name: p.name,
      color: p.color ?? PALETTE[merged.length % PALETTE.length],
      notes: p.notes,
    })
  }

  return merged
}
