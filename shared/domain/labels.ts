/**
 * ラベルマーカーを取り除きつつ、その位置を labels マップへ記録する。
 * テキスト台本パーサー(parser.ts)とエディタのコンパイラ(project/compile.ts)
 * の両方で同じ形の処理が必要になるため、共通化している。
 */
type LabelMarker = { type: 'label'; name: string }

export function resolveLabels<T extends { type: string }>(
  items: (T | LabelMarker)[],
): { instructions: T[]; labels: Record<string, number> } {
  const instructions: T[] = []
  const labels: Record<string, number> = {}

  for (const item of items) {
    if (item.type === 'label') {
      labels[(item as LabelMarker).name] = instructions.length
      continue
    }
    instructions.push(item as T)
  }

  return { instructions, labels }
}
