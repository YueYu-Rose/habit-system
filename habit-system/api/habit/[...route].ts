import cors from "cors";
import express from "express";
import { getHabitDb } from "../../server/db";
import { createHabitRouter } from "../../server/routes/habitRoutes";

let appSingleton: express.Express | null = null;

function getApp(): express.Express {
  if (appSingleton) return appSingleton;
  const app = express();
  app.use(cors({ origin: true }));
  app.use(express.json());
  app.use("/api/habit", createHabitRouter());
  appSingleton = app;
  return appSingleton;
}

export default async function handler(req: express.Request, res: express.Response): Promise<void> {
  // Ensure DB bootstrap for function cold starts.
  getHabitDb();
  const app = getApp();
  app(req, res);
}
