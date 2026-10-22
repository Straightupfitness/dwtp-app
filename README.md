# DWTP app

The client app for the Driven Woman Transformation Program: Capacity Circles, the 26-week Main Trajectory, weekly check-ins with AI-drafted replies, AI food logging (photo and voice), daily weight, community and messaging. Trainerize keeps the workouts until Phase 3.

Built with Next.js (App Router), Supabase (database, login, storage) and Vercel (hosting). Lives at **app.straightupfitness.com**.

Program design docs (in the Claude project): 23 Capacity Circles · 24 App Plan · 26 Reply Voice Guide · 27 26-Week Trajectory · 28 Check-in Questions · 29 7X and Onboarding.

## Setup (Michael)

1. **Supabase:** create a project named "DWTP". In the SQL editor, run these files in order:
   - `supabase/migrations/0001_init.sql`
   - `supabase/migrations/0002_profile_on_signup.sql`
   - `supabase/seed/01_circles.sql` (all Capacity Circles, rings and items)
   - `supabase/seed/02_trajectory.sql` (the 26-week Main Trajectory)
   - `supabase/migrations/0003_food_photos.sql` (private storage for meal photos)
2. **Your coach login:** Supabase → Authentication → Users → Add user (your email). Then in the SQL editor:
   `update public.profiles set role = 'coach', full_name = 'Michael Duivis' where email = 'YOUR EMAIL';`
3. **Vercel:** Add New → Project → import `Straightupfitness/dwtp-app`.
4. **Environment variables** (Vercel → Project → Settings → Environment Variables), using `.env.example` as the list. Values come from Supabase (Project Settings → API) and console.anthropic.com. Never commit them.
5. **Domain:** Vercel → Project → Settings → Domains → add `app.straightupfitness.com`, then add the CNAME record Vercel shows at your domain provider.

## Develop

```bash
npm install
npm run dev
```

## Regenerating content

The seed files are generated from the program design docs:

```bash
python3 scripts/build_seed.py path/to/DWTP_Circle_System_Design.md
python3 scripts/build_trajectory_seed.py path/to/DWTP_26_Week_Main_Trajectory.md
```
