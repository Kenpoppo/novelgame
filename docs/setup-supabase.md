# Supabase セットアップ手順(公開機能を使うために)

このアプリはローカル(IndexedDB)モードだけなら何も設定せずに動く。
「他のユーザーもプレイできるように公開する」機能を使うには、以下の手順で
Supabase プロジェクトを作成し、接続情報を設定する必要がある。

これらはAIエージェントが代行できない作業(外部アカウント作成)のため、
ユーザー自身で行う。

## 1. Supabase プロジェクトを作成する

1. [supabase.com](https://supabase.com/) でアカウントを作成し、新しい
   プロジェクトを作成する(リージョンは日本に近い場所を推奨)。
2. プロジェクト作成完了まで数分待つ。

## 2. マイグレーションを実行する

`supabase/migrations/0001_init.sql` の内容を、Supabaseダッシュボードの
「SQL Editor」に貼り付けて実行する(`profiles`/`projects`/`game_saves`
テーブル、RLSポリシー、Storageバケット `character-images`/`audio` が
作成される)。

Supabase CLI を使っている場合は以下でも良い:

```bash
supabase link --project-ref <あなたのプロジェクトref>
supabase db push
```

## 3. 接続情報を控える

ダッシュボードの `Settings > API` から以下を控える:

- **Project URL**(例: `https://xxxxxxxx.supabase.co`)
- **anon / public キー**

## 4. 環境変数を設定する

`.env.example` を `.env` にコピーし、値を埋める:

```bash
SUPABASE_URL=https://xxxxxxxx.supabase.co
SUPABASE_KEY=<anon public キー>
```

`npm run dev` を再起動すると、ログイン・公開機能が有効になる。

## 5. 動作確認

1. `/login` で新規登録(メール確認が有効な場合は届いたメールのリンクを
   クリックして `/confirm` に戻ってくる)。
2. `/editor` の「公開する」ボタンで作品を公開する。
3. `/`(ギャラリー)に公開した作品が表示され、`/play/<id>` で誰でも
   プレイできることを確認する。

## 6. デプロイ時の設定

Cloudflare Pages(推奨、`docs/architecture.md` 参照)にデプロイする場合、
プロジェクトの環境変数に `SUPABASE_URL`/`SUPABASE_KEY` を同様に設定する。
Vercel 等の他プラットフォームでも同じ環境変数名で動作する。

## トラブルシューティング

- 公開ボタンでエラーが出る場合、まずブラウザのコンソールと
  Supabaseダッシュボードの `Logs` を確認する。
- RLSポリシー由来のエラー(`new row violates row-level security policy` 等)
  は、ログインしているユーザーと `owner_id` が一致していない場合に起きる。
  マイグレーションが正しく適用されているか確認する。
