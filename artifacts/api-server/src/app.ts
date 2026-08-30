import express, { type ErrorRequestHandler, type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();
const allowedOrigins = new Set(
  (process.env.CORS_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) {
      callback(null, true);
      return;
    }
    callback(null, false);
  },
}));
app.use(express.json({ limit: "64kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb", parameterLimit: 100 }));

app.use("/api", router);

const apiErrorHandler: ErrorRequestHandler = (error, req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  const errorType = (error as { type?: unknown })?.type;
  if (errorType === "entity.too.large") {
    res.status(413).json({ error: "Request payload is too large." });
    return;
  }
  if (errorType === "entity.parse.failed") {
    res.status(400).json({ error: "Request body must be valid JSON." });
    return;
  }

  req.log.error({ kind: "unhandled-api-error" }, "Unhandled API error");
  res.status(500).json({ error: "The server could not complete the request." });
};

app.use(apiErrorHandler);

export default app;
