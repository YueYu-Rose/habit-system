-- Habit System — Supabase (Postgres) schema
-- 在 Supabase Dashboard → SQL Editor 中执行本文件
-- 说明：Habits + 内嵌打卡「日志」= catalog JSON（customDone）；Rewards = rows JSON；Mainline 循环 = state JSON

-- 可选：启用 uuid 函数（一般已启用）
-- create extension if not exists "pgcrypto";

-- 1) 用户习惯 + 内嵌「日志」于 catalog（无单独 logs 表；含 customDone 打卡、customWallet、dayTimes 入睡/起床 ISO 等）
create table if not exists public.user_habit_data (
  user_id uuid primary key references auth.users (id) on delete cascade,
  catalog jsonb not null default '{"v":1,"items":[],"customDone":{},"customWallet":0,"dayTimes":{}}'::jsonb,
  updated_at timestamptz not null default now()
);

-- 2) 用户奖励表（本地 RewardCatalogItem[] 镜像）
create table if not exists public.user_reward_data (
  user_id uuid primary key references auth.users (id) on delete cascade,
  rows jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- 3) 用户主线/可用分池（与 MainlineLoopState 一致）
create table if not exists public.user_mainline_data (
  user_id uuid primary key references auth.users (id) on delete cascade,
  state jsonb not null default '{"version":1,"spendableDelta":0,"current":null,"archived":[]}'::jsonb,
  updated_at timestamptz not null default now()
);

-- updated_at: 由客户端在 upsert 时写入；列默认 now() 用于首次 insert

-- Row Level Security
alter table public.user_habit_data enable row level security;
alter table public.user_reward_data enable row level security;
alter table public.user_mainline_data enable row level security;

-- 已登录用户仅可读写自己的行（user_id = auth.uid()）
create policy "user_habit_data_select_own"
  on public.user_habit_data for select
  using (auth.uid() = user_id);

create policy "user_habit_data_insert_own"
  on public.user_habit_data for insert
  with check (auth.uid() = user_id);

create policy "user_habit_data_update_own"
  on public.user_habit_data for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "user_habit_data_delete_own"
  on public.user_habit_data for delete
  using (auth.uid() = user_id);

create policy "user_reward_data_select_own"
  on public.user_reward_data for select
  using (auth.uid() = user_id);

create policy "user_reward_data_insert_own"
  on public.user_reward_data for insert
  with check (auth.uid() = user_id);

create policy "user_reward_data_update_own"
  on public.user_reward_data for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "user_reward_data_delete_own"
  on public.user_reward_data for delete
  using (auth.uid() = user_id);

create policy "user_mainline_data_select_own"
  on public.user_mainline_data for select
  using (auth.uid() = user_id);

create policy "user_mainline_data_insert_own"
  on public.user_mainline_data for insert
  with check (auth.uid() = user_id);

create policy "user_mainline_data_update_own"
  on public.user_mainline_data for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "user_mainline_data_delete_own"
  on public.user_mainline_data for delete
  using (auth.uid() = user_id);

-- 如创建时尚无 auth 用户，表会在首次注册后由客户端 upsert 写入
comment on table public.user_habit_data is 'Habit catalog + embedded check-in log (customDone) per user';

-- JSON `catalog` 与「习惯/日志」扩展字段（无单独 habits/logs 表时由客户端在 items 与 recordedTimes 中维护，语义对齐）：
--   items[].target_type 对应客户端：targetType，取值 'boolean' | 'time'（HabitDef.targetType）
--   打卡时刻：无 systemKey 且 targetType=time 时，客户端 recordedTimes[habitId][YYYY-MM-DD] = ISO 时间戳（对 logs.recorded_time）
--   系统入睡/起床仍使用 catalog.dayTimes[date].sleepIso / wakeIso
comment on table public.user_reward_data is 'Reward rows JSON for redeems (promotion/personal)';
comment on table public.user_mainline_data is 'Mainline quest loop (spendable pool, current, archived)';
