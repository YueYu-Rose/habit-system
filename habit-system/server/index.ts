import "dotenv/config";
import express from "express";
import cors from "cors";
import { getHabitDb } from "./db.js";
import { createHabitRouter } from "./routes/habitRoutes.js";

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "habit-system" });
});

app.use("/api/habit", createHabitRouter());

getHabitDb();

const port = Number(process.env.HABIT_API_PORT) || 3002;
app.listen(port, () => {
  console.log(`[habit-api] http://localhost:${port}`);
});
