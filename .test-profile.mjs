import { parseProfileText } from './shared/domain/project/profileImport.ts'
import { readFileSync } from 'node:fs'

const text = readFileSync('.test-profile-input.txt', 'utf8')
const entries = parseProfileText(text)
console.log('検出件数:', entries.length)
for (const [i, e] of entries.entries()) {
  console.log(`[${i + 1}] name="${e.name}" color=${e.color ?? '-'} notes=${e.notes ? e.notes.slice(0, 40) + '…' : '(なし)'}`)
}
