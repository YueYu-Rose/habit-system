# ✨ Habit System: AI-Powered Personal Growth Lab

<div align="center">

![Habit System — check-ins, mainline, rewards, AI coach](https://placehold.co/1200x420/0f172a/38bdf8?text=Habit+System+%E2%80%94+Personal+Growth+Lab&font=montserrat)

*可替换为产品截图：打卡页、复盘、主线等真实界面。*

**在线使用 / Live site:** [https://habit-system-phi.vercel.app/](https://habit-system-phi.vercel.app/)  
*部署在 Vercel，与 `main` 分支持续发布。*

</div>

> *"What gets measured gets managed — but what gets *played* gets remembered."*  
> — *Inspired by Drucker, remixed for gamified habit design.*

---

## 🧭 Product vision

**Why it exists?** To bridge *habit formation* and *long-term motivation* through **gamification** and **AI** — turning daily micro-actions into a visible point economy, a mainline quest, and an LLM coach that reads *your* week, not a generic post.

---

## 🎯 核心能力（面向真实用户）

| 能力 | 作用 | 对用户的价值 |
|------|------|----------------|
| **AI 习惯教练** | 汇总**近 7 天**本机打卡（入睡、起床、语言习惯等），将结构化上文发到 **OpenAI 兼容**接口，返回 **清晰、Markdown** 建议。 | 把行为数据变成**可执行**的回顾与提醒。 |
| **动态奖励** | 习惯积分进**可花余额**；多档**奖励单**可兑换/撤销。 | 形成「赚取 → 兑换 → 正反馈」的闭环。 |
| **主线与主线足迹** | 长目标、快捷加分、外接任务可加分；**成长足迹**记录正向注能历史。 | 长周期目标有可见进度与记录。 |
| **移动优先 UI** | 高对比、打卡为中心，本机/云端数据可用。 | 适合每天多次打开。 |

---

## 🚀 如何迭代的

项目用 **React + Vite + TypeScript** 持续交付；需求与 `env` 驱动**同一套代码**下的多种部署方式（全功能/轻量变体等），不依赖重文档先行。

- **想法 → 可跑版本：** 路由、首屏、习惯闭环快速落地。  
- **规格 → 可合并的改动：** 功能以可审查的 diff 落地，再手工收束体验与安全（密钥不进仓库等）。  
- **CI → 线上：** `main` 推 GitHub 后 Vercel 构建；文首有当前正式地址。  

---

## 🧱 技术结构

- **Client:** **React 18** + **TypeScript** + **Vite**  
- **Styling:** **`habit.css`** 设计系统；可按需在 Tailwind 中扩展。  
- **Data（优先离线在浏览器）：** **LocalStorage** 存习惯表、打卡、奖励、主线路径；可选 **Supabase** 登录与多设备同步。  
- **可选本地扩展：** `server/` 下 Express + SQLite 等，用于本机全栈/账本，与纯前端可并存。  

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

## ⚙️ 环境模式：`PERSONAL` 与 `PROMOTION`

通过构建时 **`VITE_APP_MODE`** 切换；两者都是**可给真实用户用的产品形态**，不是「假数据玩具」与「真产品」的对立，而是**能力组合**不同：

| 模式 | 定位 | 工程侧 |
|------|------|--------|
| **`PERSONAL`** | 默认的**全能力**变体：Supabase 登录/同步、外接能力等可配置打开，适合**日常自用**和本地/自建。 | 按 `env` 接云与扩展后端。 |
| **`PROMOTION`** | **轻量公网**变体：不强制接私有后端，习惯/奖励等可用本机首屏模板 + 可选邮箱类登录；**核心闭环不依赖**本地额外 API 服务。 | 离线优先、本机存状态与模板。  

同一仓库、**配置驱动**分支，减少复制粘贴多份业务代码。

---

## 🗺️ Roadmap（示例方向）

- 多设备/多人协作的云端习惯与 RLS 细化。  
- 轻量社交/问责（可选、非信息流）。  
- AI 教练：流式回复、与账本工具调用等。  
- E2E、可访问性、PWA 安装。

---

## ▶️ How to run

### 用线上还是本机？

| 场景 | 说明 |
|------|------|
| **日常使用** | 直接打开 [https://habit-system-phi.vercel.app/](https://habit-system-phi.vercel.app/)。**正式环境**，不依赖你本机是否装 Node。数据在各自浏览器中（可登录并用 Supabase 同步）。 |
| **本地 = 开发** | 在 `habit-system` 下 `npm run dev` 用于**改代码、接 env、自测**；与线上是**同一套产品**，数据按域名/账号隔离。 |

### 本地开发

```bash
cd habit-system
npm install
npm run dev
```

- 终端会打印本机地址（常见 `http://localhost:5173`）。  
- 与公网轻量变体接近的构建（可选）：`npm run build:promo`（`production` 模式，与 `VITE_APP_MODE` 及 env 一致）。  
- 预览生产包：`npm run build` 后 `npm run preview`。

### 环境变量（Vercel / 本机 `.env`）

| Variable | 说明 |
|----------|------|
| `VITE_APP_MODE` | `PROMOTION` 或 `PERSONAL`（见上文） |
| `VITE_SUPABASE_URL` | 选填；填写后可启用 Supabase 登录与同步 |
| `VITE_SUPABASE_ANON_KEY` | Supabase 项目 **anon** 公钥 |

> 勿把密钥写进版本库；仅放环境变量与本地 `*.local`。

---

## 📄 License

以作者/仓库约定为准；未另行声明时，默认专有使用。

---

<p align="center">
  <strong>Habit System</strong> — *认真生活，把自己养好。*
</p>
