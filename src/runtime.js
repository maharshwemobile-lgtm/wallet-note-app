import express from "express";
import cookieParser from "cookie-parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SYSTEM_SHEET_ID } from "./sheets-client.js";
import { SYSTEM_TABS, ensureTabs } from "./schema.js";
import { accountRoutes } from "./account-routes.js";
import { walletBetRoutes } from "./wallet-bets-routes.js";
import { debtExchangeRoutes } from "./debt-exchange-routes.js";

const app = express();
const port = Number(process.env.PORT || 3005);
const host = process.env.BIND_HOST || "127.0.0.1";
const root = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(root, "..", "public");

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(express.json({ limit: "250kb" }));
app.use(cookieParser());
app.use(express.static(publicDir, { maxAge: "1h", etag: true }));

accountRoutes(app);
walletBetRoutes(app);
debtExchangeRoutes(app);

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "wallet-note-node-multi-user" });
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || "Server error" });
});

ensureTabs(SYSTEM_SHEET_ID, SYSTEM_TABS)
  .then(() => {
    app.listen(port, host, () => {
      console.log(`Wallet Note running on http://${host}:${port}`);
    });
  })
  .catch((err) => {
    console.error("Wallet Note startup failed:", err);
    process.exit(1);
  });
