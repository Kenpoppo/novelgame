import { parseScript } from '../parser'
import { sampleScriptText } from '../scripts/sample-script'
import type { Instruction } from '../types'
import { createId } from './types'
import type { Beat, Project } from './types'

function instructionToBeat(instruction: Instruction): Beat {
  switch (instruction.type) {
    case 'dialogue':
      return { id: createId(), type: 'dialogue', characterId: instruction.speaker, text: instruction.text }
    case 'jump':
      return { id: createId(), type: 'jump', target: instruction.target }
    case 'choice':
      return { id: createId(), type: 'choice', options: instruction.options }
    case 'bgm':
    case 'se':
      throw new Error(`サンプル台本には含まれないはずの命令です: ${instruction.type}`)
  }
}

/**
 * 初回起動時、保存済みプロジェクトがまだ無い場合のシード。
 * 既存のテキスト台本(scripts/sample-script.ts)を使い回すことで、
 * エディタの初回表示が空白にならず taro/hana の例で使い方を示せる。
 */
export function createSampleProject(): Project {
  const parsed = parseScript(sampleScriptText)

  const labelsByIndex = new Map<number, string[]>()
  for (const [name, index] of Object.entries(parsed.labels)) {
    const names = labelsByIndex.get(index) ?? []
    names.push(name)
    labelsByIndex.set(index, names)
  }

  const beats: Beat[] = []
  for (let i = 0; i <= parsed.instructions.length; i++) {
    for (const name of labelsByIndex.get(i) ?? []) {
      beats.push({ id: createId(), type: 'label', name })
    }
    const instruction = parsed.instructions[i]
    if (instruction) {
      beats.push(instructionToBeat(instruction))
    }
  }

  return {
    title: '夏の放課後(サンプル)',
    characters: Object.values(parsed.characters).map((character) => ({
      id: character.id,
      name: character.name,
      color: character.color,
    })),
    audio: [],
    beats,
  }
}
