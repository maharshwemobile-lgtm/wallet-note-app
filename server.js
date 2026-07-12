import dotenv from "dotenv";

dotenv.config({ path: ".env.production" });
dotenv.config();

await import("./src/runtime.js");
