import crypto from "node:crypto";
import {SYSTEM_SHEET_ID,readTable} from "./sheets-client.js";
const COOKIE="wallet_note_session",SECRET=process.env.JWT_SECRET||"change-this-wallet-note-secret";
let cache={until:0,rows:[]};
export async function getUsers(force=false){if(!force&&Date.now()<cache.until)return cache.rows;cache={until:Date.now()+15000,rows:(await readTable(SYSTEM_SHEET_ID,"Users")).rows};return cache.rows}
export function invalidateUsers(){cache.until=0}
const sig=s=>crypto.createHmac("sha256",SECRET).update(s).digest("base64url");
function make(userId){const e=Buffer.from(JSON.stringify({userId,expiresAt:Date.now()+604800000})).toString("base64url");return`${e}.${sig(e)}`}
function parse(v){try{const[e,s]=String(v||"").split(".");if(!e||!s||sig(e)!==s)return null;const p=JSON.parse(Buffer.from(e,"base64url").toString("utf8"));return p.userId&&p.expiresAt>Date.now()?p:null}catch{return null}}
export function setSession(res,userId){res.cookie(COOKIE,make(userId),{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",path:"/",maxAge:604800000})}
export function clearSession(res){res.clearCookie(COOKIE,{path:"/"})}
export async function currentUser(req){const p=parse(req.cookies[COOKIE]);if(!p)return null;return(await getUsers()).find(u=>u.id===p.userId&&u.status==="Active")||null}
export async function auth(req,res,next){try{const u=await currentUser(req);if(!u)return res.status(401).json({error:"Unauthorized"});req.user=u;next()}catch(e){next(e)}}
export function requireSheet(req,res,next){const id=req.user?.spreadsheetId?.trim();if(!id)return res.status(409).json({error:"Google Sheet is not connected",code:"SHEET_NOT_CONNECTED"});req.spreadsheetId=id;next()}
