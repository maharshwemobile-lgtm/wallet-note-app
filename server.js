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

const app=express(),PORT=Number(process.env.PORT||3005),HOST=process.env.HOSTNAME||"127.0.0.1";
const root=path.dirname(fileURLToPath(import.meta.url));
app.disable("x-powered-by");
app.set("trust proxy",1);
app.use(express.json({limit:"250kb"}));
app.use(cookieParser());
app.use(express.static(path.join(root,"public"),{maxAge:"1h",etag:true}));
accountRoutes(app);
walletBetRoutes(app);
debtExchangeRoutes(app);
app.get("/api/health",(req,res)=>res.json({ok:true,service:"wallet-note-node-multi-user"}));
app.get("*",(req,res)=>res.sendFile(path.join(root,"public","index.html")));
app.use((err,req,res,next)=>{console.error(err);res.status(500).json({error:err.message||"Server error"})});
ensureTabs(SYSTEM_SHEET_ID,SYSTEM_TABS).then(()=>app.listen(PORT,HOST,()=>console.log(`Wallet Note running on http://${HOST}:${PORT}`))).catch(err=>{console.error("Wallet Note startup failed:",err);process.exit(1)});
