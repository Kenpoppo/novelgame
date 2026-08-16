-- novelgame: 初期スキーマ
-- 実行方法は docs/setup-supabase.md を参照。

-- プロフィール(auth.users の付随情報)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles are viewable by everyone"
  on public.profiles for select
  using (true);

create policy "users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- サインアップ時に profiles 行を自動作成
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.email);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- プロジェクト(ストーリー本体)。エディタの Project 型をそのまま jsonb で保持する。
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  title text not null default '無題のストーリー',
  content jsonb not null,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists projects_owner_id_idx on public.projects (owner_id);
create index if not exists projects_published_idx on public.projects (published) where published = true;

alter table public.projects enable row level security;

create policy "published projects are viewable by everyone, drafts by their owner"
  on public.projects for select
  using (published = true or auth.uid() = owner_id);

create policy "owners can insert their own projects"
  on public.projects for insert
  with check (auth.uid() = owner_id);

create policy "owners can update their own projects"
  on public.projects for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "owners can delete their own projects"
  on public.projects for delete
  using (auth.uid() = owner_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at
  before update on public.projects
  for each row execute procedure public.set_updated_at();

-- ゲーム内セーブ(次フェーズでUIを実装。スキーマのみ先に用意)
create table if not exists public.game_saves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  save_data jsonb not null,
  updated_at timestamptz not null default now()
);

create unique index if not exists game_saves_user_project_idx on public.game_saves (user_id, project_id);

alter table public.game_saves enable row level security;

create policy "users manage their own saves"
  on public.game_saves for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Storage: キャラ画像・音声アップロード用バケット
insert into storage.buckets (id, name, public)
values ('character-images', 'character-images', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('audio', 'audio', true)
on conflict (id) do nothing;

create policy "anyone can read character images"
  on storage.objects for select
  using (bucket_id = 'character-images');

create policy "owners can upload their own character images"
  on storage.objects for insert
  with check (bucket_id = 'character-images' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "anyone can read audio"
  on storage.objects for select
  using (bucket_id = 'audio');

create policy "owners can upload their own audio"
  on storage.objects for insert
  with check (bucket_id = 'audio' and (storage.foldername(name))[1] = auth.uid()::text);
