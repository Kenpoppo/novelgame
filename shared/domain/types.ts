export interface CharacterDef {
  id: string
  name: string
  color?: string
  imageDataUrl?: string
  // 状況に応じた第2の立ち絵(表情違い/ポーズ違いなど)。dialogue命令の
  // useAltImage=true のときに優先して表示する。
  imageAltDataUrl?: string
}

export type Instruction =
  | { type: 'dialogue'; speaker: string | null; text: string; useAltImage?: boolean }
  | { type: 'jump'; target: string }
  | { type: 'choice'; options: { text: string; target: string }[] }
  | { type: 'bgm'; src: string | null }
  | { type: 'se'; src: string }

export interface ParsedScript {
  instructions: Instruction[]
  labels: Record<string, number>
  characters: Record<string, CharacterDef>
}
