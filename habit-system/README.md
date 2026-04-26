# 个人养成系统（中文版）

## 技术栈

- 前端：Vite + React + TypeScript + React Router（端口 **5174**）
- 后端：Express + better-sqlite3（端口 **3002**）
- 数据：`habit-system/data/habit.db`

## 本地运行

```bash
cd habit-system
npm install
npm run dev
```

- 浏览器打开：**http://localhost:5174**
- API 健康检查：**http://localhost:3002/api/health**

## 与英文 To-do List 联动（未来）

1. **推荐**：英文站提供只读 `GET /api/todo/day?date=YYYY-MM-DD`（或专用导出接口），在 `server/services/externalTodoAdapter.ts` 中实现 `fetchExternalTodoCompletionRate`，配置 `external_todo_config.mode = 'http'` 与 `base_url`。
2. **同机共享 SQLite**：仅开发机可行，两应用读同一 `app.db` 需处理路径与锁。
3. **导出文件**：定时 JSON + 本系统定时导入 `external_todo_snapshots`。

当前「记录」页可**手动录入**总任务数/完成数，用于测试完成率计分。

## 每日结算

**仅手动触发**：在「记录」页点击「结算今日」，服务端汇总当日 `point_ledger` 并写入 `daily_settlements`。应用内**没有**定时任务或午夜自动结算。

## 阶段任务 / 自定义任务与积分

- 在「任务」页创建任务时可填**完成分值**与**未完成扣分**（均为 5 的倍数；服务端会就近取整）。
- 点击**完成**会加分、**未完成**会扣分（需未完成扣分大于 0），并写入 `point_ledger`（`source_type: manual`），首页可用积分与「记录」页流水会更新。
- 同一任务同一 habit 日只能完成或扣分一次（幂等）。

## 验收测试清单（建议顺序）

1. **启动**：`cd habit-system` → `npm install` → `npm run dev`，浏览器打开 http://localhost:5174 。
2. **首页**：确认显示当日日期、可用积分、本周净积分；点「去任务页打卡」进入任务页。
3. **必做打卡**：在任务页依次点「开始睡觉」「起床了」「已洗澡」等（可按你当日流程选几项）；回首页看可用积分是否变化。
4. **阶段 / 自定义任务**：新建一条阶段任务（如完成 +10、未完成 −5）；在列表中先点「完成」，首页应 +10；再新建另一条并点「未完成」，应 −5。**记录**页「积分流水」应出现对应标题与分数。
5. **奖励**：进「奖励」页，选一项有足够积分的奖励点「兑换」；可用积分减少，**记录**页下方「兑换记录」出现一条。
6. **每日结算**：在「记录」页点「结算今日」；无报错即表示当日汇总已写入结算表（不改变余额，仅记账汇总）。

## 目录说明

- `server/` — 养成 API、迁移、积分与外部 To-do 适配层
- `src/` — 中文前端（首页、任务、日常、奖励、记录、主线）
