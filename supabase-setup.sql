create table if not exists public.tasks (
    id uuid primary key,
    title text not null,
    description text not null default '',
    attachment_path text,
    attachment_name text,
    attachment_type text,
    attachment_url text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint tasks_attachment_metadata check (
        (
            attachment_name is null
            and attachment_path is null
            and attachment_type is null
            and attachment_url is null
        )
        or (
            attachment_name is not null
            and (attachment_path is not null or attachment_url is not null)
        )
    )
);

create table if not exists public.task_admins (
    user_id uuid primary key references auth.users(id) on delete cascade,
    created_at timestamptz not null default now()
);

grant select on public.tasks to anon, authenticated;
grant insert, update, delete on public.tasks to authenticated;
grant select on public.task_admins to authenticated;
grant select on storage.objects to anon, authenticated;
grant insert, update, delete on storage.objects to authenticated;

alter table public.tasks enable row level security;
alter table public.task_admins enable row level security;

drop policy if exists "Tasks are visible to everyone" on public.tasks;
create policy "Tasks are visible to everyone"
    on public.tasks for select
    to anon, authenticated
    using (true);

drop policy if exists "Admins can add tasks" on public.tasks;
create policy "Admins can add tasks"
    on public.tasks for insert
    to authenticated
    with check (
        exists (
            select 1 from public.task_admins
            where task_admins.user_id = (select auth.uid())
        )
    );

drop policy if exists "Admins can edit tasks" on public.tasks;
create policy "Admins can edit tasks"
    on public.tasks for update
    to authenticated
    using (
        exists (
            select 1 from public.task_admins
            where task_admins.user_id = (select auth.uid())
        )
    )
    with check (
        exists (
            select 1 from public.task_admins
            where task_admins.user_id = (select auth.uid())
        )
    );

drop policy if exists "Admins can delete tasks" on public.tasks;
create policy "Admins can delete tasks"
    on public.tasks for delete
    to authenticated
    using (
        exists (
            select 1 from public.task_admins
            where task_admins.user_id = (select auth.uid())
        )
    );

drop policy if exists "Admins can view their own admin record" on public.task_admins;
create policy "Admins can view their own admin record"
    on public.task_admins for select
    to authenticated
    using (user_id = (select auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit)
values ('task-attachments', 'task-attachments', true, 52428800)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit;

drop policy if exists "Task attachments are public" on storage.objects;
create policy "Task attachments are public"
    on storage.objects for select
    to anon, authenticated
    using (bucket_id = 'task-attachments');

drop policy if exists "Admins can upload task attachments" on storage.objects;
create policy "Admins can upload task attachments"
    on storage.objects for insert
    to authenticated
    with check (
        bucket_id = 'task-attachments'
        and exists (
            select 1 from public.task_admins
            where task_admins.user_id = (select auth.uid())
        )
    );

drop policy if exists "Admins can update task attachments" on storage.objects;
create policy "Admins can update task attachments"
    on storage.objects for update
    to authenticated
    using (
        bucket_id = 'task-attachments'
        and exists (
            select 1 from public.task_admins
            where task_admins.user_id = (select auth.uid())
        )
    )
    with check (
        bucket_id = 'task-attachments'
        and exists (
            select 1 from public.task_admins
            where task_admins.user_id = (select auth.uid())
        )
    );

drop policy if exists "Admins can delete task attachments" on storage.objects;
create policy "Admins can delete task attachments"
    on storage.objects for delete
    to authenticated
    using (
        bucket_id = 'task-attachments'
        and exists (
            select 1 from public.task_admins
            where task_admins.user_id = (select auth.uid())
        )
    );

insert into public.tasks (
    id,
    title,
    description,
    attachment_name,
    attachment_type,
    attachment_url
)
values (
    '00000000-0000-4000-8000-000000000001',
    'Task 1 - Curriculum Vitae',
    E'Fresh Graduate Curriculum Vitae (CV) Submission\n\nThis document is a text-based submission for Task 1, featuring a professional English Curriculum Vitae (CV) tailored for a fresh graduate in Electrical Engineering (B.A.Sc.). It covers professional summary, educational background, work experience, organizational roles, certifications, and technical skill sets.',
    'CV GILANG EKA PRATAMA 2026.pdf',
    'application/pdf',
    'assets/pdf/CV%20GILANG%20EKA%20PRATAMA%202026.pdf'
)
on conflict (id) do nothing;
