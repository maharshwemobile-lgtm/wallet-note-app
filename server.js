import express from "express";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import path from "node:path";
import {fileURLToPath} from "node:url";

dotenv.config({path:".env.production"});
dotenv.config();

const [{SYSTEM_SHEET_ID},{SYSTEM_TABS,ensureTabs},{accountRoutes},{walletBetRoutes},{debtExchangeRoutes}]=await Promise.all([
  import("./src/sheets-client.js"),
  import("./src/schema.js"),
  import("./src/account-routes.js"),
  import("./src/wallet-bets-routes.js"),
  import("./src/debt-exchange-routes.js")
]);

const app=express(),PORT