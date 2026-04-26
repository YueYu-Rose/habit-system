import "dotenv/config";
import express from "express";
import cors from "cors";
import { getDb } from "./db.js";
import { createApiRouter } from "./routes/api.js";
import { createGoogleOAuthDevRouter } from "./routes/googleOAuthDev.js";

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());
app.use("/api", createApiRouter());

/** Local refresh-token helper — only when not in production. */
if (process.env.NODE_ENV !== "production") {
  app.use("/api/dev/google-oauth", createGoogleOAuthDevRouter());
}

getDb();

const port = Number(process.env.PORT) || 3001;
app.listen(port, () => {
  console.log(`[api] http://localhost:${port}`);
});
