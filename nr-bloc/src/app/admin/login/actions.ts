"use server";

import crypto from "node:crypto";
import { redirect } from "next/navigation";
import { createSession } from "@/lib/session";

export type LoginState = {
  error?: string;
};

function safeCompare(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

export async function login(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const password = String(formData.get("password") || "");
  const expected = process.env.ADMIN_PASSWORD;

  if (!expected) {
    return { error: "Admin login is not configured." };
  }

  if (!password || !safeCompare(password, expected)) {
    return { error: "Incorrect password." };
  }

  await createSession();
  redirect("/admin");
}
