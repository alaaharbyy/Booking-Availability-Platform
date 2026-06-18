import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { asyncHandler, sendError, sendSuccess } from "./http/index.js";
import { assertDatabaseHealthy } from "./lib/database.js";
import { authRouter } from "./routes/auth.routes.js";
import { experiencesRouter } from "./routes/experiences.routes.js";

export const app = express();

app.use(express.json());

app.get(
  "/health",
  asyncHandler(async (_req, res) => {
    await assertDatabaseHealthy();
    sendSuccess(res, { status: "ok", database: "connected" });
  }),
);

app.use("/auth", authRouter);
app.use("/experiences", experiencesRouter);

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  sendError(res, err);
});
