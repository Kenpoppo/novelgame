import { compileProject } from '#shared/domain/project/compile'
import type { Project } from '#shared/domain/project/types'

/** セリフ(dialogue)ビートが1件も無ければ「台本が無い」とみなす。 */
function hasScriptContent(project: Project): boolean {
  return project.beats.some((beat) => beat.type === 'dialogue')
}

/**
 * 「プレイ/プレビュー」ボタンの共通ガード。
 *
 * 台本(セリフ)が1件も無い状態でプレイ画面に遷移すると、何も起きない
 * 空のプレイヤー画面に着地してしまい分かりにくいため、先に台本の有無を
 * チェックし、無ければ台本読み込み/ストーリー編集への案内ダイアログを
 * 出す。コンパイルエラー(キャラ参照切れ等)は従来通り呼び出し側で表示する。
 *
 * `editor/index.vue`・`editor/branches.vue`・`PreviewButton.vue`・
 * `start.vue` の4箇所で同種のプレイ導線ロジックが個別実装されていたため、
 * 1箇所に集約する(台本読み込み機能で起きた重複実装の教訓を踏まえた対応)。
 */
export function useGoToPreview(target: string = '/play/local') {
  const store = useProjectStore()
  const router = useRouter()

  const showNoScriptDialog = ref(false)
  const compileErrors = ref<string[] | null>(null)

  function goToPreview(): void {
    if (!store.project) return
    showNoScriptDialog.value = false
    compileErrors.value = null

    if (!hasScriptContent(store.project)) {
      showNoScriptDialog.value = true
      return
    }

    const result = compileProject(store.project)
    if (!result.ok) {
      compileErrors.value = result.errors
      return
    }
    router.push(target)
  }

  return { showNoScriptDialog, compileErrors, goToPreview }
}
