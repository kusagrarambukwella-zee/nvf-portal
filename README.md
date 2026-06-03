# NovahFalcons — Cloudflare Pages + Supabase

## Structure
```
/                        → Coming Soon (novahfalcons.com)
/client-portal/          → Client Portal login
/client-portal/admin/    → Admin pages
/client-portal/portal/   → Client pages
/client-portal/assets/   → CSS, JS, logo
supabase-schema.sql      → Run in Supabase SQL Editor
```

## Setup
1. Create Supabase project → run supabase-schema.sql
2. Edit client-portal/assets/supabase.js → add your URL + anon key
3. Push to GitHub → connect to Cloudflare Pages
4. Set build output directory: `/` (root)
5. Point novahfalcons.com DNS to Cloudflare Pages

## First Admin User
In Supabase Dashboard → Authentication → Users → Add user:
- Email: kusagra@novahfalcons.com
- Password: (strong password)
- User Metadata: {"role": "admin", "full_name": "Kusagra Rambukwella"}
