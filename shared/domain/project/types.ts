export interface CharacterAsset {
  id: string
  name: string
  color?: string
  imageDataUrl?: string
}

export interface AudioCue {
  id: string
  kind: 'bgm' | 'se'
  label: string
  fileDataUrl?: string
  sourceNote?: string
}

/**
 * エディタ上でのみ存在する「ビート」。label は再生用データへコンパイルする際に
 * resolveLabels() で取り除かれ、labels マップへ解決される。
 */
export type Beat =
  | { id: string; type: 'dialogue'; characterId: string | null; text: string }
  | { id: string; type: 'label'; name: string }
  | { id: string; type: 'jump'; target: string }
  | { id: string; type: 'choice'; options: { text: string; target: string }[] }
  | { id: string; type: 'bgm'; audioId: string | null }
  | { id: string; type: 'se'; audioId: string }

export interface Project {
  title: string
  characters: CharacterAsset[]
  audio: AudioCue[]
  beats: Beat[]
}

export function createId(): string {
  return crypto.randomUUID()
}

export function createEmptyProject(title = '無題のストーリー'): Project {
  return { title, characters: [], audio: [], beats: [] }
}
