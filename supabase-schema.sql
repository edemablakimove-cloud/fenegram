create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  handle text not null unique,
  display_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_handle_format check (handle ~ '^[a-z0-9_]{3,24}$')
);

create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 4000),
  created_at timestamptz not null default now()
);

create table if not exists public.blocked_users (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint blocked_users_not_self check (blocker_id <> blocked_id)
);

alter table public.profiles enable row level security;
alter table public.direct_messages enable row level security;
alter table public.blocked_users enable row level security;

drop policy if exists "profiles are readable by signed in users" on public.profiles;
create policy "profiles are readable by signed in users"
on public.profiles for select
to authenticated
using (true);

drop policy if exists "users can insert own profile" on public.profiles;
create policy "users can insert own profile"
on public.profiles for insert
to authenticated
with check (id = auth.uid());

drop policy if exists "users can update own profile" on public.profiles;
create policy "users can update own profile"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "users can read own direct messages" on public.direct_messages;
create policy "users can read own direct messages"
on public.direct_messages for select
to authenticated
using (sender_id = auth.uid() or recipient_id = auth.uid());

drop policy if exists "users can send direct messages" on public.direct_messages;
create policy "users can send direct messages"
on public.direct_messages for insert
to authenticated
with check (
  sender_id = auth.uid()
  and not exists (
    select 1
    from public.blocked_users
    where blocker_id = recipient_id
      and blocked_id = auth.uid()
  )
);

drop policy if exists "users can read own blocks" on public.blocked_users;
create policy "users can read own blocks"
on public.blocked_users for select
to authenticated
using (blocker_id = auth.uid());

drop policy if exists "users can block others" on public.blocked_users;
create policy "users can block others"
on public.blocked_users for insert
to authenticated
with check (blocker_id = auth.uid());

drop policy if exists "users can unblock others" on public.blocked_users;
create policy "users can unblock others"
on public.blocked_users for delete
to authenticated
using (blocker_id = auth.uid());

create index if not exists direct_messages_sender_created_idx on public.direct_messages(sender_id, created_at desc);
create index if not exists direct_messages_recipient_created_idx on public.direct_messages(recipient_id, created_at desc);
create index if not exists profiles_handle_idx on public.profiles(handle);

do $$
begin
  alter publication supabase_realtime add table public.direct_messages;
exception
  when duplicate_object then null;
end $$;
