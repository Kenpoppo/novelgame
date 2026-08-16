export interface CharacterDef {
  id: string
  name: string
  color?: string
  imageDataUrl?: string
}

export type Instruction =
  | { type: 'dialogue'; speaker: string | null; text: string }
  | { type: 'jump'; target: string }
  | { type: 'choice'; options: { text: string; target: string }[] }
  | { type: 'bgm'; src: string | null }
  | { type: 'se'; src: string }

export interface ParsedScript {
  instructions: Instruction[]
  labels: Record<string, number>
  characters: Record<string, CharacterDef>
}
