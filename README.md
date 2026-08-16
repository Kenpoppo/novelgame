# novelgame

ブラウザだけでノベルゲーム(ビジュアルノベル)を作成でき、作った作品を
他のユーザーにも公開してプレイしてもらえるエンジン。タイトル・キャラクター・
ストーリー・選択肢・分岐・BGM/SE をGUIエディタで組み立てられ、既存の台本を
読み込んでAI(または簡易ルールベース)で自動設定することもできる。

## 技術スタック

| カテゴリ | 採用 |
|---|---|
| フロント / ビルド | Vue 3 + Nuxt 4(内部はVite) |
| 状態管理 | Pinia |
| ルーティング | Nuxtのファイルベースルーティング |
| シナリオ(ドメインモデル) | 自作(`Project`/`Beat`/`Instruction`、`shared/domain/`) |
| 音声 | Howler.js |
| UI | Tailwind CSS + カスタムCSS。「ポップ・任天堂ゲーム風」デザイン(丸ゴシック体+ビビッドな配色+立体的なボタン) |
| バックエンド | Nuxt Nitroサーバールート(`server/api/`) |
| DB / 認証 / ストレージ | Supabase(Postgres, Auth, Storage) |
| AI(台本解析) | Anthropic API(`claude-opus-5`)。未設定でもヒューリスティック解析にフォールバック |
| 配信 | Cloudflare Pages(想定) |

アーキテクチャ(Clean Architecture簡略版)の詳細は
[docs/architecture.md](docs/architecture.md) を参照。

## クイックスタート

```bash
npm install
npm run dev
```

`http://localhost:3000/editor` でエディタが開く。ここまではSupabase未設定
でも動作する(ローカル/IndexedDBモードのみで、作品の公開・ログインだけが
使えない状態になる)。

他のユーザーに作品を公開できるようにするには、Supabaseプロジェクトを
作成して接続する必要がある。手順は
[docs/setup-supabase.md](docs/setup-supabase.md) を参照。

台本の「AI解析」による自動読み込みを使うには `ANTHROPIC_API_KEY` を設定する
(未設定でも簡易ルールベース解析にフォールバックして動作する)。詳細は
[docs/script-import.md](docs/script-import.md) を参照。

### その他のコマンド

```bash
npm run build       # 本番ビルド
npm run preview     # 本番ビルドをローカルで確認
npm run typecheck   # 型チェック(vue-tsc)
```

## ドキュメント

詳細なドキュメント一覧は [docs/README.md](docs/README.md) を参照。

- [docs/architecture.md](docs/architecture.md) — システムアーキテクチャ
- [docs/editor.md](docs/editor.md) — エディタのデータモデル・保存方式・公開フロー
- [docs/script-format.md](docs/script-format.md) — 台本テキスト形式の仕様
- [docs/audio-sources.md](docs/audio-sources.md) — BGM/SEのフリー素材サイト
- [docs/setup-supabase.md](docs/setup-supabase.md) — Supabaseセットアップ手順
- [docs/script-import.md](docs/script-import.md) — 台本の自動読み込み(AI解析)
- [docs/player.md](docs/player.md) — プレイ画面の構成(登場人物リスト・TTS等)
- [docs/decisions.md](docs/decisions.md) — 設計判断ログ

方針や構成を変えたら、該当ドキュメントの更新を `docs/decisions.md` への
追記とセットで行う。
