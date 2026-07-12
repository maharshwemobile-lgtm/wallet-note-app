import { google } from "googleapis";
export const SYSTEM_SHEET_ID=process.env.SYSTEM_GOOGLE_SHEET_ID||process.env.GOOGLE_SHEET_ID||"";
export function sheets(){const email=process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;const key=process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g,"\n");if(!SYSTEM_SHEET_ID||!email||!key)throw new Error("Google Sheets environment variables are incomplete");return google.sheets({version:"v4",auth:new google.auth.JWT({email,key,scopes:["https://www.googleapis.com/auth/spreadsheets"]})})}
export async function readTable(id,tab){const r=await sheets().spreadsheets.values.get({spreadsheetId:id,range:`${tab}!A:AZ`});const v=r.data.values||[],h=v[0]||[];return{headers:h,rows:v.slice(1).filter(x=>x.some(Boolean)).map((x,i)=>({__rowNumber:i+2,...Object.fromEntries(h.map((k,j)=>[k,x[j]??""]))}))}}
export async function appendObject(id,tab,obj){const{headers}=await readTable(id,tab);await sheets().spreadsheets.values.append({spreadsheetId:id,range:`${tab}!A:AZ`,valueInputOption:"USER_ENTERED",insertDataOption:"INSERT_ROWS",requestBody:{values:[headers.map(h=>obj[h]??"")]}})}
export function num(v){const n=Number(String(v??"").replace(/,/g,""));return Number.isFinite(n)?n:0}
export function clean(r){const{__rowNumber,...x}=r;return x}
