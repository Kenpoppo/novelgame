import type { Instruction, ParsedScript } from '../types'
import { createId } from './types'
import type { Beat, CharacterAsset } from './types'

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
