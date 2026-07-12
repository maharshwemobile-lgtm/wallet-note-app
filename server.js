import express from "express";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import { google } from "googleapis";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

dotenv.config({ path: ".env.production" });
dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3005);
const HOST = process.env.HOSTNAME || "127.0.0.1";
const SHEET_ID = process.env.GOOGLE_SHEET_ID || process.env.SYSTEM_GOOGLE_SHEET_ID || "";
const APP_PASSWORD = process.env.APP_PASSWORD || "";
const SESSION_SECRET = process.env.JWT_SECRET || "wallet-note-secret";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(express.json({ limit: "200kb" }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public"), { maxAge: "1h" }));

function sheetsClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!SHEET_ID || !email || !key) throw new Error("Google Sheets environment is incomplete");
  const auth = new google.auth.JWT({ email, key, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
  return google.sheets({ version: "v4", auth });
}

const tabs = {
  Wallet: ["id","createdAt","type","currency","amount","note"],
  Bets: ["id","createdAt","customerName","phone","number","amount","currency","paymentStatus","agentName","agentAmount","settled"],
  Debts: ["id","createdAt","kind","personName","amount","currency","referenceId","status","note"],
  Exchange: ["id","createdAt","customerName","thbReceived","rate","mmkPaid","fee","profitType","note"]
};

async function ensureTabs() {
  const client = sheetsClient();
  const meta = await client.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const existing = new Set((meta.data.sheets || []).map(s => s.properties?.title));
  const requests = Object.keys(tabs).filter(t => !existing.has(t)).map(title => ({ addSheet: { properties: { title } } }));
  if (requests.length) await client.spreadsheets.batchUpdate({ spreadsheetId: SHEET_ID, requestBody: { requests } });
  for (const [title, headers] of Object.entries(tabs)) {
    const r = await client.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `${title}!1:1` });
    if (!(r.data.values?.[0]?.length)) {
      await client.spreadsheets.values.update({ spreadsheetId: SHEET_ID, range: `${title}!A1`, valueInputOption: "USER_ENTERED", requestBody: { values: [headers] } });
    }
  }
}

async function rows(tab) {
  const client = sheetsClient();
  const r = await client.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `${tab}!A:Z` });
  const values = r.data.values || [];
  if (values.length < 2) return [];
  const headers = values[0];
  return values.slice(1).filter(row => row.some(Boolean)).map(row => Object.fromEntries(headers.map((h,i) => [h, row[i] ?? ""])));
}

async function append(tab, values) {
  const client = sheetsClient();
  await client.spreadsheets.values.append({ spreadsheetId: SHEET_ID, range: `${tab}!A:Z`, valueInputOption: "USER_ENTERED", insertDataOption: "INSERT_ROWS", requestBody: { values: [values] } });
}

function sign(value) { return crypto.createHmac("sha256", SESSION_SECRET).update(value).digest("hex"); }
function auth(req,res,next) {
  if (!APP_PASSWORD) return next();
  const token = req.cookies.wallet_session;
  if (token && token === sign("ok")) return next();
  res.status(401).json({ error: "Unauthorized" });
}

app.post("/api/login", (req,res) => {
  if (!APP_PASSWORD || req.body?.password === APP_PASSWORD) {
    res.cookie("wallet_session", sign("ok"), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 30*24*60*60*1000 });
    return res.json({ ok: true });
  }
  res.status(401).json({ error: "Wrong password" });
});
app.get("/api/session", (req,res) => res.json({ required: Boolean(APP_PASSWORD), authenticated: !APP_PASSWORD || req.cookies.wallet_session === sign("ok") }));
app.post("/api/logout", (req,res) => { res.clearCookie("wallet_session"); res.json({ ok: true }); });

app.get("/api/summary", auth, async (req,res,next) => {
  try {
    const [wallet,bets,debts,exchange] = await Promise.all([rows("Wallet"),rows("Bets"),rows("Debts"),rows("Exchange")]);
    const balance = currency => wallet.filter(x=>x.currency===currency).reduce((s,x)=>s + (x.type==="IN"?1:-1)*Number(x.amount||0),0);
    res.json({ balances:{THB:balance("THB"),MMK:balance("MMK")}, bets:bets.length, customerDebt:debts.filter(x=>x.kind==="RECEIVABLE"&&x.status!=="PAID").reduce((s,x)=>s+Number(x.amount||0),0), agentPayable:debts.filter(x=>x.kind==="PAYABLE"&&x.status!=="PAID").reduce((s,x)=>s+Number(x.amount||0),0), exchange:exchange.slice(-20).reverse() });
  } catch(e){ next(e); }
});

app.get("/api/wallet", auth, async (req,res,next)=>{ try{ res.json((await rows("Wallet")).reverse()); }catch(e){next(e);} });
app.post("/api/wallet", auth, async (req,res,next)=>{ try{
  const {type,currency,amount,note=""}=req.body||{};
  if(!["IN","OUT"].includes(type)||!["THB","MMK"].includes(currency)||!(Number(amount)>0)) return res.status(400).json({error:"Invalid data"});
  await append("Wallet",[crypto.randomUUID(),new Date().toISOString(),type,currency,Number(amount),String(note).slice(0,300)]);
  res.json({ok:true});
}catch(e){next(e);} });

app.get("/api/bets", auth, async (req,res,next)=>{ try{ res.json((await rows("Bets")).reverse()); }catch(e){next(e);} });
app.post("/api/bets", auth, async (req,res,next)=>{ try{
  const {customerName,phone="",number,amount,currency="MMK",paymentStatus="PAID",agentName="",agentAmount=0}=req.body||{};
  if(!customerName||!/^\d{3}$/.test(String(number))||!(Number(amount)>0)) return res.status(400).json({error:"အမည်၊ 3D နံပါတ်နဲ့ ငွေပမာဏစစ်ပါ"});
  const id=crypto.randomUUID(); const now=new Date().toISOString();
  await append("Bets",[id,now,customerName,phone,String(number),Number(amount),currency,paymentStatus,agentName,Number(agentAmount||0),"OPEN"]);
  if(paymentStatus==="PAID") await append("Wallet",[crypto.randomUUID(),now,"IN",currency,Number(amount),`3D ${customerName} ${number}`]);
  else await append("Debts",[crypto.randomUUID(),now,"RECEIVABLE",customerName,Number(amount),currency,id,"OPEN",`3D ${number}`]);
  if(agentName&&Number(agentAmount)>0) await append("Debts",[crypto.randomUUID(),now,"PAYABLE",agentName,Number(agentAmount),currency,id,"OPEN",`3D ${number}`]);
  res.json({ok:true});
}catch(e){next(e);} });

app.get("/api/debts", auth, async (req,res,next)=>{ try{ res.json((await rows("Debts")).reverse()); }catch(e){next(e);} });
app.post("/api/debts/:id/pay", auth, async (req,res,next)=>{ try{
  const client=sheetsClient(); const all=await client.spreadsheets.values.get({spreadsheetId:SHEET_ID,range:"Debts!A:Z"}); const values=all.data.values||[]; const idx=values.findIndex((r,i)=>i>0&&r[0]===req.params.id);
  if(idx<0) return res.status(404).json({error:"Not found"});
  const headers=values[0]; const statusCol=headers.indexOf("status"); const row=values[idx];
  await client.spreadsheets.values.update({spreadsheetId:SHEET_ID,range:`Debts!${String.fromCharCode(65+statusCol)}${idx+1}`,valueInputOption:"USER_ENTERED",requestBody:{values:[["PAID"]]}});
  const kind=row[headers.indexOf("kind")], currency=row[headers.indexOf("currency")], amount=Number(row[headers.indexOf("amount")]||0), name=row[headers.indexOf("personName")];
  await append("Wallet",[crypto.randomUUID(),new Date().toISOString(),kind==="RECEIVABLE"?"IN":"OUT",currency,amount,`${kind==="RECEIVABLE"?"Debt received":"Agent paid"}: ${name}`]);
  res.json({ok:true});
}catch(e){next(e);} });

app.get("/api/exchange", auth, async (req,res,next)=>{ try{ res.json((await rows("Exchange")).reverse()); }catch(e){next(e);} });
app.post("/api/exchange", auth, async (req,res,next)=>{ try{
  const {customerName="",thbReceived,rate,fee=0,profitType="RATE",note=""}=req.body||{};
  const thb=Number(thbReceived), r=Number(rate), f=Number(fee||0); if(!(thb>0)||!(r>0)) return res.status(400).json({error:"ဘတ်နဲ့ Rate စစ်ပါ"});
  const mmk=thb*r; const now=new Date().toISOString();
  await append("Exchange",[crypto.randomUUID(),now,customerName,thb,r,mmk,f,profitType,note]);
  await append("Wallet",[crypto.randomUUID(),now,"IN","THB",thb,`Exchange ${customerName}`]);
  await append("Wallet",[crypto.randomUUID(),now,"OUT","MMK",mmk,`Exchange ${customerName}`]);
  if(f>0) await append("Wallet",[crypto.randomUUID(),now,"IN","MMK",f,`Exchange fee ${customerName}`]);
  res.json({ok:true,mmkPaid:mmk});
}catch(e){next(e);} });

app.get("/api/health", (req,res)=>res.json({ok:true,service:"wallet-note-node"}));
app.get("*", (req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));
app.use((err,req,res,next)=>{ console.error(err); res.status(500).json({error:err.message||"Server error"}); });

ensureTabs().then(()=>app.listen(PORT,HOST,()=>console.log(`Wallet Note running on http://${HOST}:${PORT}`))).catch(err=>{console.error(err);process.exit(1);});
