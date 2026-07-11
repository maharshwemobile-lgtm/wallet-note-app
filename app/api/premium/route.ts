import { NextResponse } from "next/server";
import { z } from "zod";
import { query, transaction } from "@/lib/db";
import { readSession } from "@/lib/auth";

const currency = z.enum(["MMK", "THB"]);
const num = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;

async function requireUser() {
  const session = await readSession();
  if (!session) return null;
  return session;
}

export