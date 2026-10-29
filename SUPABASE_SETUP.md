# Supabase setup for shared task management

GitHub Pages serves static files only. Supabase provides the shared database, public attachment storage, and admin authentication used by this site.

## 1. Create a Supabase project

Create a project at [supabase.com](https://supabase.com). In **Project Settings → API**, copy the project URL and the publishable key (or legacy anon key). These are public client values; never put a `service_role` or secret key in this website.

## 2. Create the database and policies

Open the Supabase **SQL Editor**, paste the contents of `supabase-setup.sql`, and run it. This creates:

- A public-read `tasks` table with admin-only create/update/delete policies.
- A `task_admins` table that grants management access only to listed accounts.
- A public `task-attachments` Storage bucket. Visitors can read attachment files; only admins can upload, replace, or delete them.
- The existing CV task, linked to the PDF already in this repository.

## 3. Configure the site

Edit `assets/js/supabase-config.js` and replace:

- `https://YOUR_PROJECT_ID.supabase.co` with your Supabase project URL. 
- `YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY` with your publishable/anon key.

Only the publishable/anon key belongs in this file. The database row-level security policies protect admin operations.

## 4. Create your admin login

In Supabase **Authentication → Users**, add a user with your admin email and a strong password. Then run this SQL in the SQL Editor, replacing the email:

```sql
insert into public.task_admins (user_id)
select id from auth.users where email = 'you@example.com'
on conflict (user_id) do nothing;
```

Keep public sign-ups disabled. To grant access to another administrator, create their Auth user and insert their user ID into `public.task_admins`.

## 5. Deploy and use

Commit/push the changed files to GitHub and wait for GitHub Pages to deploy. Open **Manage Tasks**, sign in, and add tasks or upload attachments (up to 50 MB). New and updated tasks are stored in Supabase and are available to all visitors as soon as the save succeeds.

Task JSON exports contain task records and attachment URLs; the actual files remain in Supabase Storage. Public attachments can be opened by anyone with access to the site.
