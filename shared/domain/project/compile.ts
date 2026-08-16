import { resolveLabels } from '../labels'
import type { CharacterDef, Instruction, ParsedScript } from '../types'
import type { Project } from './types'

export type CompileResult = { ok: true; script: ParsedScript } | { ok: false; errors: string[] }

export function compileProject(project: Project): CompileResult {
  const errors: string[] = []

  const characters: Record<string, CharacterDef> = {}
  for (const character of project.characters) {
    characters[character.id] = character
  }

  const audioById = new Map(project.audio.map((cue) => [cue.id, cue]))

  const seenLabels = new Set<string>()
  const items: (Instruction | { type: 'label'; name: string })[] = []

  for (const beat of project.beats) {
    switch (beat.type) {
      case 'dialogue': {
        if (beat.characterId !== null && !characters[beat.characterId]) {
          errors.push(`台詞「${beat.text}」のキャラクターが見つかりません`)
        }
        items.push({
          type: 'dialogue',
          speaker: beat.characterId,
          text: beat.text,
          ...(beat.useAltImage ? { useAltImage: true } : {}),
        })
        break
      }
      case 'label': {
        if (seenLabels.has(beat.name)) {
          errors.push(`ラベル「${beat.name}」が重複しています`)
        }
        seenLabels.add(beat.name)
        items.push({ type: 'label', name: beat.name })
        break
      }
      case 'jump': {
        items.push({ type: 'jump', target: beat.target })
        break
      }
      case 'choice': {
        items.push({ type: 'choice', options: beat.options })
        break
      }
      case 'bgm': {
        if (beat.audioId === null) {
          items.push({ type: 'bgm', src: null })
          break
        }
        const cue = audioById.get(beat.audioId)
        if (!cue) {
          errors.push('BGMビートが参照している音源がライブラリに見つかりません')
          break
        }
        // 実ファイル未添付の場合は執筆を止めないよう、無音のまま読み飛ばす
        if (cue.fileDataUrl) {
          items.push({ type: 'bgm', src: cue.fileDataUrl })
        }
        break
      }
      case 'se': {
        const cue = audioById.get(beat.audioId)
        if (!cue) {
          errors.push('SEビートが参照している音源がライブラリに見つかりません')
          break
        }
        if (cue.fileDataUrl) {
          items.push({ type: 'se', src: cue.fileDataUrl })
        }
        break
      }
    }
  }

  const { instructions, labels } = resolveLabels(items)

  for (const instruction of instructions) {
    if (instruction.type === 'jump' && labels[instruction.target] === undefined) {
      errors.push(`ジャンプ先のラベル「${instruction.target}」が見つかりません`)
    }
    if (instruction.type === 'choice') {
      for (const option of instruction.options) {
        if (labels[option.target] === undefined) {
          errors.push(`選択肢「${option.text}」の飛び先ラベル「${option.target}」が見つかりません`)
        }
      }
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors }
  }

  return { ok: true, script: { instructions, labels, characters } }
}
