# 时间规划 / To-do 与养成系统（本仓库）

本仓库包含两个独立子项目，**端口互不冲突**，但需**分别启动**（或一条命令同时起四个进程）。

## 端口一览

| 项目 | 前端（Vite） | 后端（Express） |
|------|----------------|-----------------|
| **英文 To-do List**（仓库根目录） | **5173**（`vite.config.ts`） | **3001**（`PORT`，默认） |
| **个人养成 habit-system**（`habit-system/`） | **5174**（`vite.config.ts` 固定） | **3002**（`HABIT_API_PORT`，默认） |

根目录 `vite.config.ts` 将 `/api` 代理到 `http://localhost:3001`。  
`habit-system/vite.config.ts` 将 `/api` 代理到 `http://localhost:3002`。

## 同时运行两个系统（推荐）

在**仓库根目录**执行（需已 `npm install` 根目录与 `habit-system` 各自依赖）：

```bash
npm run dev:all
```

会并行启动：

- **todo**：`npm run dev` → API `3001` + 前端 **5173**
- **habit**：`habit-system` 内 `npm run dev` → API `3002` + 前端 **5174**

浏览器：

- To-do List：**http://localhost:5173**
- 养成系统：**http://localhost:5174**

## 分开两个终端启动

| 终端 | 目录 | 命令 |
|------|------|------|
| 1 | 仓库根目录 | `npm run dev` |
| 2 | 仓库根目录 | `npm run dev:habit`（等同于 `cd habit-system && npm run dev`） |

地址同上。

## 只运行其中一个

- 仅 To-do：根目录 `npm run dev`
- 仅养成：`cd habit-system` → `npm run dev`

---

若 5173/5174/3001/3002 已被占用，请先关闭占用进程或改环境变量 / Vite 端口配置。

---

## Google Calendar OAuth（英文 To-do API）

同步接口：`POST /api/sync/google-calendar`（需根目录 API **端口 3001**）。`invalid_grant` 几乎总是 **refresh token 失效**，或 **客户端 ID/密钥/重定向 URI** 与签发该 token 的 OAuth 应用不一致。

### 必须一致的三件事

1. **`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`**  
   必须来自 **Google Cloud Console → APIs & Services → Credentials** 里 **同一个「OAuth 2.0 Client ID」**（Web application）。若你轮换过 Secret 或新建了另一个 Client，旧 refresh token 会失效，需按下面步骤换新 token。

2. **`GOOGLE_OAUTH_REDIRECT_URI`（可选）**  
   未设置时默认为：  
   `http://localhost:3001/api/dev/google-oauth/callback`  
   该字符串须与 Console 里 **Authorized redirect URIs** 中某一项 **完全一致**（含 `http`、端口、路径，无末尾 `/`）。

3. **`GOOGLE_REFRESH_TOKEN`**  
   由下方 dev 授权页签发；**只认与当前 Client ID + 上面 redirect 组合匹配的那一条**。换 Client 或改 redirect 后，**应整条替换**旧值，不要拼接多段。

### 如何重新生成 `GOOGLE_REFRESH_TOKEN`（开发环境）

1. 确认 **API 在本机 `PORT=3001`** 运行（`npm run dev` 于仓库根目录）。
2. 浏览器打开：**http://localhost:3001/api/dev/google-oauth**（会重定向到 Google 登录）。
3. 用 **已加入该 OAuth 应用「测试用户」列表** 的 Google 账号完成授权（若为 Testing 外部用户未添加会失败）。
4. 回调页会显示一行：`GOOGLE_REFRESH_TOKEN=...`  
   - **完整复制**到根目录 `.env`（或更新已有行）。  
   - **删除**旧的 `GOOGLE_REFRESH_TOKEN` 行再粘贴，避免重复键或残留字符。  
   - 值内**不要**加引号；保存后**重启** API 进程。
5. 若回调页没有 `refresh_token`：到 [Google 账号 → 第三方应用访问](https://myaccount.google.com/permissions) 撤销本应用，再重复步骤 2–4（dev 路由已带 `prompt=consent` 以尽量重新下发 refresh token）。

### 是否应完全替换旧 refresh token？

**是。** 同一 Client 下新 refresh token 生效后，旧 token 通常即作废；`.env` 中只保留 **一条** 当前使用的 `GOOGLE_REFRESH_TOKEN`。

### `invalid_grant` 自查清单

| 检查项 | 说明 |
|--------|------|
| Client 一致 | ID/Secret 与生成 token 时是否为同一 OAuth 客户端 |
| Token 未撤销 | 用户是否在 Google 账号里撤销了应用访问 |
| Redirect 一致 | Console、`.env` 中 `GOOGLE_OAUTH_REDIRECT_URI`、代码默认三者一致 |
| 测试用户 | 外部应用处于 Testing 时，当前账号须在 OAuth 同意屏的 Test users 中 |
| 无多余空白 | `.env` 中值首尾无空格/换行（代码已对值做 `trim`，但建议保持整洁） |

API 在检测到 `invalid_grant` 时会在错误信息中附带简短修复提示（见 `server/config/googleOAuth.ts` 中 `GOOGLE_INVALID_GRANT_HINT`）。
