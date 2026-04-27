# ✨ Habit System: AI-Powered Personal Growth Lab

**Languages / 语言:** English · [中文 (简体)](README.zh-CN.md)

<div align="center">

![Habit System — check-ins, mainline, rewards, AI coach](https://placehold.co/1200x420/0f172a/38bdf8?text=Habit+System+%E2%80%94+Personal+Growth+Lab&font=montserrat)

*Replace the hero with real product screenshots: check-in, report, main quest, etc.*

**Live site:** [https://habit-system-phi.vercel.app/](https://habit-system-phi.vercel.app/)  
*Production deploy on Vercel, built from the `main` branch.*

</div>

> *"What gets measured gets managed — but what gets *played* gets remembered."*  
> — *Inspired by Drucker, remixed for gamified habit design.*

---

## Product vision

**Why it exists:** to connect *habit building* and *long-term motivation* with **gamification** and **AI** — turning everyday micro-actions into a visible point economy, a mainline quest, and an LLM coach that reads *your* week, not a generic post.

---

## Key features (for real users)

| Feature | What it does | User value |
|--------|--------------|------------|
| **AI habit coach** | Summarises **7 days** of on-device check-ins (sleep, wake, language, etc.), sends structured context to an **OpenAI-compatible** API, returns **clear Markdown** guidance. | Turns behaviour into **actionable** review and nudges. |
| **Reward economy** | Habit points feed **spendable** balance; a **multi-tier** reward list with redeem / undo. | A closed loop: **earn → redeem → positive feedback**. |
| **Main quest & trail** | Long goals, quick adds, and external tasks can add points; **Progress trail** records positive “energy” history. | Long-horizon goals stay visible. |
| **Mobile-first UI** | High-contrast, check-in centred; data in the browser and optionally in the cloud. | Built for many opens per day. |

---

## How we ship

The app is **React + Vite + TypeScript**, shipped in tight loops. Requirements and `env` drive **one codebase** and multiple deploy shapes (full vs lighter), without a heavy spec-up-front process.

- **Idea → runnable build:** routing, first screen, core habit loop, fast.  
- **Spec → reviewable diffs:** features land as mergeable changes, then refinements to UX and safety (no secrets in the repo).  
- **CI → production:** push `main` to GitHub, Vercel builds; the live URL is at the top of this file.

---

## Technical architecture

- **Client:** **React 18** + **TypeScript** + **Vite**  
- **Styling:** **`habit.css`** design system; optional Tailwind where wired.  
- **Data (browser-first):** **LocalStorage** for habit catalog, check-ins, rewards, mainline; optional **Supabase** auth and cross-device sync.  
- **Optional local stack:** Express + SQLite under `server/` for a fuller ledger on your machine, alongside the SPA.

```text
┌─────────────┐     ┌──────────────────┐
│   Vite UI   │────▶│  LocalStorage    │
│  (Habits,   │     │  (check-ins,     │
│  rewards)   │     │  rewards, meta)  │
└─────────────┘     └──────────────────┘
         │                    │
         └────────────────────┴──▶ Supabase (auth / sync) when configured
```

---

## Environment modes: `PERSONAL` vs `PROMOTION`

Switched at **build time** with **`VITE_APP_MODE`**. Both are **real product variants** — not “toy” vs “real”, but different **capability sets**:

| Mode | Role | Engineering |
|------|------|-------------|
| **`PERSONAL`** | **Full** default: Supabase sign-in / sync, integrations, etc., configurable. Suited to **everyday** use and self-hosting. | Cloud and backends via `env`. |
| **`PROMOTION`** | **Lighter** public deploy: no private backend required; habits/rewards can start from on-device templates + optional email-style auth; **core loop** does not need a local API. | Offline-first, local state and templates. |

One repository, **config-driven** split, to avoid duplicating product logic.

---

## Roadmap (directional)

- Deeper cloud habits and RLS for multi-device / collaboration.  
- Light accountability (optional, not a feed).  
- AI coach: streaming, tool use against your ledger, etc.  
- E2E, accessibility, PWA “add to home screen”.

---

## How to run

### Use the cloud or develop locally?

| Scenario | Notes |
|----------|--------|
| **Day-to-day use** | Open [https://habit-system-phi.vercel.app/](https://habit-system-phi.vercel.app/) — **production**; no local Node required. Data lives per browser; sign in for Supabase sync if you configure it. |
| **Local = development** | In `habit-system`, `npm run dev` for code changes, env, and testing — **the same app**; data is isolated by origin / account. |

### Local development

```bash
cd habit-system
npm install
npm run dev
```

- The printed URL is usually `http://localhost:5173` (another port if busy).  
- **Closer to a lighter public build (optional):** `npm run build:promo` in `production` mode, aligned with `VITE_APP_MODE` and your env.  
- **Preview the production bundle:** `npm run build` then `npm run preview`.

### Environment variables (Vercel and local `.env`)

| Variable | Notes |
|----------|--------|
| `VITE_APP_MODE` | `PROMOTION` or `PERSONAL` (see above) |
| `VITE_SUPABASE_URL` | Optional; enables Supabase auth and sync when set |
| `VITE_SUPABASE_ANON_KEY` | Supabase project **anon** (public) key |

> Do not commit secrets. Keep them in env and local `*.local` files only.

---

## License

Proprietary / by author and repo terms unless stated otherwise.

---

<p align="center">
  <strong>Habit System</strong> — *Build habits that move your life forward.*
</p>
