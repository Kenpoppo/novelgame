import { parseScript } from '#shared/domain/parser'
import {
  analysisToProjectFragments,
  analyzeScriptHeuristically,
  dslResultToAnalysis,
  extractProfileSection,
  mergeProfilesIntoCharacters,
  removeProfileSection,
} from '#shared/domain/project/scriptImport'
import { parseProfileText } from '#shared/domain/project/profileImport'
import type { Beat, CharacterAsset } from '#shared/domain/project/types'

interface AnalyzeResponse {
  ok: boolean
  reason?: string
  analysis?: {
    title: string | null
    characters: { name: string; color: string | null }[]
    beats: { speaker: string | null; text: string }[]
  }
}

export interface ImportPreview {
  title?: string
  characters: CharacterAsset[]
  beats: Beat[]
  usedAi: boolean
}

export interface ImportBreakdown {
  scriptCharacters: number
  profileSectionFound: boolean
  profileEntries: number
  mergedEntries: number
  profileOnlyAdded: number
}

function emptyBreakdown(): ImportBreakdown {
  return {
    scriptCharacters: 0,
    profileSectionFound: false,
    profileEntries: 0,
    mergedEntries: 0,
    profileOnlyAdded: 0,
  }
}

/**
 * 「台本を読み込む」機能の共通ロジック(composable)。
 *
 * /editor/import と /start(オンボーディングウィザード)の両方から使う。
 * 過去、この2ページに同じロジックが別々に実装されており、一方だけ
 * 修正が入って他方に反映されず、`extractProfileSection()` を通さない
 * 旧ロジックが `/editor/import` に残留していた結果、台本全文が丸ごと
 * プロフィール解析にかけられてキャラが数百件検出されるバグが発生した
 * (本編のセリフブロック「名前」+「セリフ」も1ブロックとして誤検出される)。
 * 同じ不具合が再発しないよう、ロジックを1箇所に統合する。
 */
export function useScriptImportAnalysis() {
  const analyzing = ref(false)
  const errorMessage = ref<string | null>(null)
  const preview = ref<ImportPreview | null>(null)
  const breakdown = ref<ImportBreakdown>(emptyBreakdown())
  const profileSuggestion = ref<{ count: number } | null>(null)

  async function analyze(rawText: string): Promise<void> {
    if (!rawText.trim()) return
    analyzing.value = true
    errorMessage.value = null
    preview.value = null
    profileSuggestion.value = null
    breakdown.value = emptyBreakdown()

    // 最初の非空行をタイトルとして扱う(本文からは常に除く)
    const titleLines = rawText.split(/\r?\n/)
    const titleLineIndex = titleLines.findIndex((line) => line.trim().length > 0)
    const firstLineTitle = titleLineIndex >= 0 ? titleLines[titleLineIndex]!.trim() : ''

    // 混在テキストでは、プロフィール解析対象を「登場人物節」だけに絞る。
    // これをしないと、本編のセリフブロック(名前+「セリフ」)まで全部
    // 「プロフィール」として拾ってしまい、キャラ数が爆発する。
    const profileSection = extractProfileSection(rawText)
    const profileEntries = profileSection ? parseProfileText(profileSection) : []
    breakdown.value.profileSectionFound = profileSection.length > 0
    breakdown.value.profileEntries = profileEntries.length

    // ビート(セリフ・ナレーション)検出は、登場人物紹介セクションを取り除いた
    // テキストにかける。取り除かないと、人物紹介の文章がすべてナレーション
    // ビートとしてストーリーに混入してしまう(詳細設定のストーリー編集画面が
    // 埋まる/プレイ中に1行ずつ送る必要が生じる、という問題があったため)。
    const scriptOnlyText = profileSection ? removeProfileSection(rawText) : rawText
    const scriptLines = scriptOnlyText.split(/\r?\n/)
    const scriptTitleLineIndex = scriptLines.findIndex((line) => line.trim().length > 0)
    const bodyText = scriptTitleLineIndex >= 0 ? scriptLines.slice(scriptTitleLineIndex + 1).join('\n') : scriptOnlyText

    const applyFragments = (fragments: { title?: string; characters: CharacterAsset[]; beats: Beat[] }, usedAi: boolean) => {
      breakdown.value.scriptCharacters = fragments.characters.length
      const before = fragments.characters.length
      fragments.characters = mergeProfilesIntoCharacters(fragments.characters, profileEntries)
      const added = fragments.characters.length - before
      breakdown.value.profileOnlyAdded = added
      breakdown.value.mergedEntries = profileEntries.length - added
      preview.value = { ...fragments, title: firstLineTitle || fragments.title, usedAi }

      console.debug('[useScriptImportAnalysis] 解析結果の内訳:', {
        ...breakdown.value,
        最終キャラクター数: fragments.characters.length,
        キャラクター一覧: fragments.characters.map((c) => c.name),
      })
    }

    try {
      // 1. 自前のテキスト台本DSLに沿っているか、まず試す(高精度)
      const parsed = parseScript(bodyText)
      const namedDialogueCount = parsed.instructions.filter(
        (instruction) => instruction.type === 'dialogue' && instruction.speaker !== null,
      ).length
      if (namedDialogueCount >= 2) {
        applyFragments(analysisToProjectFragments(dslResultToAnalysis(parsed)), false)
        return
      }

      // 2. AIでの解析を試す(サーバー側でANTHROPIC_API_KEY未設定なら ok:false)
      const result = await $fetch<AnalyzeResponse>('/api/import/analyze', {
        method: 'POST',
        body: { text: bodyText },
      })

      if (result.ok && result.analysis) {
        applyFragments(
          analysisToProjectFragments({
            title: result.analysis.title ?? undefined,
            characters: result.analysis.characters.map((character) => ({
              name: character.name,
              color: character.color ?? undefined,
            })),
            beats: result.analysis.beats,
          }),
          true,
        )
      } else {
        applyFragments(analysisToProjectFragments(analyzeScriptHeuristically(bodyText)), false)
      }

      // 台本として解析したがキャラがほぼ検出できず、プロフィール形式として
      // 読めそうな場合はヒントを出す。
      // (preview.value の型はVueのUnwrapRefがBeatの判別共用体を通すと
      // 崩れてしまうため、ここだけ明示的にキャストして回避している)
      const resultBeats = (preview.value as ImportPreview | null)?.beats as Beat[] | undefined
      const namedBeatCount = resultBeats?.filter((b) => b.type === 'dialogue' && b.characterId).length ?? Infinity
      if (preview.value && namedBeatCount < 2 && profileEntries.length >= 3) {
        profileSuggestion.value = { count: profileEntries.length }
      }
    } catch {
      applyFragments(analysisToProjectFragments(analyzeScriptHeuristically(bodyText)), false)
    } finally {
      analyzing.value = false
    }
  }

  function reset(): void {
    analyzing.value = false
    errorMessage.value = null
    preview.value = null
    breakdown.value = emptyBreakdown()
    profileSuggestion.value = null
  }

  return { analyzing, errorMessage, preview, breakdown, profileSuggestion, analyze, reset }
}
