# ✨ Habit System: AI-Powered Personal Growth Lab

<div align="center">

![Habit System — check-ins, mainline, rewards, AI coach](https://placehold.co/1200x420/0f172a/38bdf8?text=Habit+System+%E2%80%94+Personal+Growth+Lab&font=montserrat)

*Replace the placeholder above with a hero screenshot: Report page + check-in, or a device mock.*

**在线访问 / Live site:** [https://habit-system-phi.vercel.app/](https://habit-system-phi.vercel.app/)  
*Production 部署在 Vercel，与 `main` 分支持续集成。*

</div>

> *"What gets measured gets managed — but what gets *played* gets remembered."*  
> — *Inspired by Drucker, remixed for gamified habit design.*

---

## 🧭 Product Vision

**Why does this exist?** To bridge the gap between *habit formation* and *long-term motivation* through **gamification** and **AI** — turning daily micro-actions into a visible point economy, a mainline quest, and an LLM coach that actually reads *your* week, not a generic blog post.

---

## 🎯 Key Features (PM Focus)

| Feature | What it does | PM angle |
|--------|--------------|----------|
| **AI Habit Coach** | Summarises **7 days of on-device check-ins** (wake, sleep, language habits, etc.), sends structured context to an **OpenAI-compatible** chat endpoint, and returns **sharp, English, Markdown** coaching. | Shows how **LLMs** turn *behavioural telemetry* into narrative and advice — the same path from *analytics event* to *insight* product managers design for. |
| **Dynamic Reward Economy** | Points from habits feed **spendable** balance; a **multi-tier reward catalog** (quick wins → refill → upgrade → milestone) with redeem / undo flows. | Illustrates **closed-loop** motivation: earn → spend → dopamine, with guardrails (local pool, tiering). |
| **Vibe-Driven UI** | Minimal, **mobile-first** “device frame” UI, high-contrast actions, check-in at the centre. | Optimised for **high-frequency, low-friction** interaction — the same bar you set for consumer habit apps. |

---

## 🚀 The “Vibe Coding” Story

> *"The best product sense is shipping sense."*

This project was not wireframed in Figma for months — it was **shipped in tight loops** using **Cursor + modern LLM assistants** as a *co-pilot*, not a replacement for judgement:

- **Idea → scaffold:** React + Vite + routing + first screens in days, not sprints.  
- **Spec → code:** feature prompts (e.g. promotion build without backend, LocalStorage seeding, i18n) turned into *reviewable* diffs, then refined by hand.  
- **CI → Vercel:** `main` 推送到 GitHub 后由 Vercel 构建部署；当前线上地址见文首 [habit-system-phi.vercel.app](https://habit-system-phi.vercel.app/)；**environment modes** 区分 demo 与完整产品。  

That is **AI PM tool mastery**: knowing *when* to delegate generation, *where* to enforce architecture (offline-first, env-based secrets, no API keys in source), and *how* to frame prompts so the output matches a **product** outcome, not a code golf exercise.

> *"Tools don’t make the PM. Instrumentation + taste + iteration do."* — the vibe we optimised for.

---

## 🧱 Technical Architecture

- **Client:** **React 18** + **TypeScript** + **Vite** (fast HMR, lean production build).  
- **Styling:** A dedicated **`habit.css` design system** (tokens, “device” layout, high-frequency check-in affordances); **Tailwind**-style utility workflow can be layered where `tailwind.config` is fully wired.  
- **Data (offline-first):** **LocalStorage** for habit catalog, check-in state, reward catalog, mainline pool, and seed data for the **PROMOTION** build — *no network required* for the core loop on the demo.  
- **Sync (optional):** **Supabase** for auth and cloud storage when `VITE_SUPABASE_*` is set.  
- **Optional backend (personal build):** Express + SQLite under `server/` for a fuller ledger when running locally (see scripts in this repo).

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

## ⚙️ Environment Modes: `PERSONAL` vs `PROMOTION`

| Mode | Intent | Engineering behaviour |
|------|--------|------------------------|
| **`PERSONAL`** | Day-to-day use with full feature surface (auth, external integrations where applicable). | May expect API base URL, backend, etc. No mock-only shortcuts unless configured. |
| **`PROMOTION`** | **Portfolio / interview demo** on Vercel: **no** dependency on a local API for core flows. | **Offline-first** habits, rewards, and seeds. |

Switch via **`VITE_APP_MODE`** at **build time** (Vite embeds it). This is a deliberate **separation of concerns**: one codebase, two *deployables*, minimal `#ifdef`-style branching — the kind of **config-driven** thinking hiring managers look for in product-minded engineers.

---

## 🗺️ Roadmap

- **Back-end:** e.g. **Supabase** (auth + sync + RLS) for real multi-device history and team-friendly habits.  
- **Social layer:** light accountability (streaks visible to friends, opt-in) without turning into another feed.  
- **AI Coach 2.0:** streaming responses, *live* windowed metrics (not just weekly), and **tool-calling** into your ledger for grounded numbers.  
- **Quality:** E2E on critical paths, accessibility audit, and PWA for “home screen” install.

---

## ▶️ How to Run

```bash
cd habit-system
npm install
npm run dev
```

- Open the local URL Vite prints (commonly `http://localhost:5174`).  
- **Production-like promotion build (optional):** `npm run build:promo` (uses Vite `production` mode; align with your `VITE_APP_MODE` and env files).

**Environment (Vercel / local):**

| Variable | Notes |
|----------|--------|
| `VITE_APP_MODE` | `PROMOTION` or `PERSONAL` |
| `VITE_SUPABASE_URL` | Optional; when set, enables Supabase auth and sync |
| `VITE_SUPABASE_ANON_KEY` | Public anon key from Supabase project settings |

> *"If it’s not in `env`, it’s not a secret. If it’s in the repo, it’s public."* — treat keys accordingly.

---

## 📄 License

Private / portfolio use unless otherwise specified by the author.

---

<p align="center">
  <strong>Habit System</strong> — *ship habits like you ship product.*
</p>
