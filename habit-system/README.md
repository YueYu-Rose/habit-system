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
- **Optional backend (仅本地全栈/扩展时):** Express + SQLite 等，在需要更完整账本的本地环境使用（与纯前端可分开维护）。

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
| **`PERSONAL`** | **全功能/开发向**：登录、Supabase 同步、外接能力等可全开；**不是**“只能作者本机用”的专属版 — 你日常也可直接用线上站，本模式多用于本地或自建部署时对齐完整能力。 | 可按 `env` 接后端、Supabase 等，无强制的 demo mock。 |
| **`PROMOTION`** | **作品展示 / 面试 demo**（Vercel 上常见）：核心闭环**不依赖**本地 API。 | **Offline-first** 习惯、奖励与种子数据。 |

Switch via **`VITE_APP_MODE`** at **build time** (Vite embeds it). This is a deliberate **separation of concerns**: one codebase, two *deployables*, minimal `#ifdef`-style branching — the kind of **config-driven** thinking hiring managers look for in product-minded engineers.

---

## 🗺️ Roadmap

- **Back-end:** e.g. **Supabase** (auth + sync + RLS) for real multi-device history and team-friendly habits.  
- **Social layer:** light accountability (streaks visible to friends, opt-in) without turning into another feed.  
- **AI Coach 2.0:** streaming responses, *live* windowed metrics (not just weekly), and **tool-calling** into your ledger for grounded numbers.  
- **Quality:** E2E on critical paths, accessibility audit, and PWA for “home screen” install.

---

## ▶️ How to Run

### 用线上还是本机？

| 场景 | 说明 |
|------|------|
| **日常使用（与作者相同）** | 打开 [https://habit-system-phi.vercel.app/](https://habit-system-phi.vercel.app/) 即可。这是与仓库同步的**正式站**，不依赖你本地是否装过 Node。数据在各自浏览器里（可配合登录与 Supabase 云同步）。 |
| **本地 = 开发版** | 在仓库里 `npm run dev` 是为了**改代码、热更新、自测、接本地 env**，不是「个人特供、别人不能跑」的用法。与线上是**同一套产品**；本机与正式站数据默认隔离（不同域名下的 LocalStorage），除非你为两边配置同一类账号与云同步。 |

### 本地开发（开发版）

```bash
cd habit-system
npm install
npm run dev
```

- 在终端里看 Vite 打印的地址，一般为 `http://localhost:5173`（端口被占用时会自动换）。  
- **接近线上演示包（可选）：** `npm run build:promo` 使用 Vite `production` 模式，请与 `VITE_APP_MODE` 及本机/CI 的 env 一致。  
- **本地预览构建结果：** `npm run build` 后执行 `npm run preview`。

### 环境变量（Vercel 与本机一致）

在 Vercel 项目设置与本地 `habit-system/.env` / `.env.local` 中配置（不要提交含密钥的 env 到 Git）：

| Variable | Notes |
|----------|--------|
| `VITE_APP_MODE` | `PROMOTION` 或 `PERSONAL`（见上文「Environment Modes」） |
| `VITE_SUPABASE_URL` | 选填；设置后可启用 Supabase 登录与数据同步 |
| `VITE_SUPABASE_ANON_KEY` | 填 Supabase 项目里的 **anon** public key |

> *"If it’s not in `env`, it’s not a secret. If it’s in the repo, it’s public."* — treat keys accordingly.

---

## 📄 License

Private / portfolio use unless otherwise specified by the author.

---

<p align="center">
  <strong>Habit System</strong> — *ship habits like you ship product.*
</p>
