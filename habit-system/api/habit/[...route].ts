import cors from "cors";
import express from "express";

let appSingleton: express.Express | null = null;

async function getApp(): Promise<express.Express> {
  if (appSingleton) return appSingleton;
  const [{ getHabitDb }, { createHabitRouter }] = await Promise.all([
    import("../../server/db.js"),
    import("../../server/routes/habitRoutes.js"),
  ]);
  // Ensure DB bootstrap for function cold starts.
  getHabitDb();
  const app = express();
  app.use(cors({ origin: true }));
  app.use(express.json());
  app.use("/api/habit", createHabitRouter());
  appSingleton = app;
  return appSingleton;
}

export default async function handler(req: express.Request, res: express.Response): Promise<void> {
  try {
    const app = await getApp();
    app(req, res);
  } catch (e) {
    console.error("[api/habit] bootstrap failed:", e);
    res.status(500).json({
      error: "Habit API bootstrap failed",
      message: e instanceof Error ? e.message : String(e),
    });
  }
}
