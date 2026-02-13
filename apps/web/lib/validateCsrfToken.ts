import { HttpError } from "@calcom/lib/http-error";
import type { NextApiRequest, NextApiResponse } from "next";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const CSRF_COOKIE_NAME = "calcom.csrf_token";
const CSRF_TOKEN_LENGTH = 64;

export async function validateCsrfToken(csrfToken: string): Promise<NextResponse | null> {
  const cookieStore = await cookies();
  const cookieToken = cookieStore.get(CSRF_COOKIE_NAME)?.value;

  if (!cookieToken || cookieToken !== csrfToken) {
    return NextResponse.json({ success: false, message: "Invalid CSRF token" }, { status: 403 });
  }
  cookieStore.delete(CSRF_COOKIE_NAME);
  return null;
}

export function validateCsrfTokenForPagesRouter(req: NextApiRequest, res: NextApiResponse): void {
  const body = req.body;
  const csrfToken = Array.isArray(body) ? body[0]?.csrfToken : body?.csrfToken;

  if (typeof csrfToken !== "string" || csrfToken.length !== CSRF_TOKEN_LENGTH) {
    throw new HttpError({ statusCode: 403, message: "Invalid CSRF token" });
  }

  const cookieToken = req.cookies[CSRF_COOKIE_NAME];

  if (!cookieToken || cookieToken !== csrfToken) {
    throw new HttpError({ statusCode: 403, message: "Invalid CSRF token" });
  }

  res.setHeader("Set-Cookie", `${CSRF_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`);
}
