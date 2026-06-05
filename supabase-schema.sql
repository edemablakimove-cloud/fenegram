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

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table if not exists public.group_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 4000),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.direct_messages enable row level security;
alter table public.blocked_users enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_messages enable row level security;

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

drop policy if exists "members can read own groups" on public.groups;
create policy "members can read own groups"
on public.groups for select
to authenticated
using (true);

drop policy if exists "users can create groups" on public.groups;
create policy "users can create groups"
on public.groups for insert
to authenticated
with check (owner_id = auth.uid());

drop policy if exists "owners can update groups" on public.groups;
create policy "owners can update groups"
on public.groups for update
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists "users can read own memberships" on public.group_members;
create policy "users can read own memberships"
on public.group_members for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1 from public.group_members own_membership
    where own_membership.group_id = group_members.group_id
      and own_membership.user_id = auth.uid()
  )
);

drop policy if exists "users can add group members" on public.group_members;
create policy "users can add group members"
on public.group_members for insert
to authenticated
with check (
  user_id = auth.uid()
  or exists (
    select 1 from public.groups
    where id = group_members.group_id
      and owner_id = auth.uid()
  )
);

drop policy if exists "owners can update group members" on public.group_members;
create policy "owners can update group members"
on public.group_members for update
to authenticated
using (
  exists (
    select 1 from public.groups
    where id = group_members.group_id
      and owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.groups
    where id = group_members.group_id
      and owner_id = auth.uid()
  )
);

drop policy if exists "members can read group messages" on public.group_messages;
create policy "members can read group messages"
on public.group_messages for select
to authenticated
using (
  exists (
    select 1 from public.group_members
    where group_id = group_messages.group_id
      and user_id = auth.uid()
  )
);

drop policy if exists "members can send group messages" on public.group_messages;
create policy "members can send group messages"
on public.group_messages for insert
to authenticated
with check (
  sender_id = auth.uid()
  and exists (
    select 1 from public.group_members
    where group_id = group_messages.group_id
      and user_id = auth.uid()
  )
);

create index if not exists direct_messages_sender_created_idx on public.direct_messages(sender_id, created_at desc);
create index if not exists direct_messages_recipient_created_idx on public.direct_messages(recipient_id, created_at desc);
create index if not exists profiles_handle_idx on public.profiles(handle);
create index if not exists groups_owner_created_idx on public.groups(owner_id, created_at desc);
create index if not exists group_members_user_idx on public.group_members(user_id);
create index if not exists group_messages_group_created_idx on public.group_messages(group_id, created_at desc);

do $$
begin
  alter publication supabase_realtime add table public.direct_messages;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.group_messages;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.group_members;
exception
  when duplicate_object then null;
end $$;
