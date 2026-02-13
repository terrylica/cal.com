import { HttpError } from "@calcom/lib/http-error";
import type { NextApiRequest, NextApiResponse } from "next";
import { describe, expect, it, vi } from "vitest";
import { validateCsrfTokenForPagesRouter } from "./validateCsrfToken";

const VALID_TOKEN = "a".repeat(64);

function createMockReqRes(options: { body?: unknown; cookies?: Record<string, string> }): {
  req: NextApiRequest;
  res: NextApiResponse;
} {
  const req = {
    body: options.body ?? {},
    cookies: options.cookies ?? {},
  } as unknown as NextApiRequest;

  const res = {
    setHeader: vi.fn(),
  } as unknown as NextApiResponse;

  return { req, res };
}

describe("validateCsrfTokenForPagesRouter", () => {
  it("passes validation when body token matches cookie token", () => {
    const { req, res } = createMockReqRes({
      body: { csrfToken: VALID_TOKEN },
      cookies: { "calcom.csrf_token": VALID_TOKEN },
    });

    expect(() => validateCsrfTokenForPagesRouter(req, res)).not.toThrow();
    expect(res.setHeader).toHaveBeenCalledWith(
      "Set-Cookie",
      expect.stringContaining("calcom.csrf_token=; Path=/; Max-Age=0")
    );
  });

  it("throws 403 when csrfToken is missing from body", () => {
    const { req, res } = createMockReqRes({
      body: {},
      cookies: { "calcom.csrf_token": VALID_TOKEN },
    });

    expect(() => validateCsrfTokenForPagesRouter(req, res)).toThrow(HttpError);
    try {
      validateCsrfTokenForPagesRouter(req, res);
    } catch (err) {
      expect((err as HttpError).statusCode).toBe(403);
    }
  });

  it("throws 403 when csrfToken has wrong length", () => {
    const { req, res } = createMockReqRes({
      body: { csrfToken: "too-short" },
      cookies: { "calcom.csrf_token": VALID_TOKEN },
    });

    expect(() => validateCsrfTokenForPagesRouter(req, res)).toThrow(HttpError);
  });

  it("throws 403 when csrfToken is not a string", () => {
    const { req, res } = createMockReqRes({
      body: { csrfToken: 12345 },
      cookies: { "calcom.csrf_token": VALID_TOKEN },
    });

    expect(() => validateCsrfTokenForPagesRouter(req, res)).toThrow(HttpError);
  });

  it("throws 403 when cookie is missing", () => {
    const { req, res } = createMockReqRes({
      body: { csrfToken: VALID_TOKEN },
      cookies: {},
    });

    expect(() => validateCsrfTokenForPagesRouter(req, res)).toThrow(HttpError);
  });

  it("throws 403 when cookie token does not match body token", () => {
    const differentToken = "b".repeat(64);
    const { req, res } = createMockReqRes({
      body: { csrfToken: VALID_TOKEN },
      cookies: { "calcom.csrf_token": differentToken },
    });

    expect(() => validateCsrfTokenForPagesRouter(req, res)).toThrow(HttpError);
  });

  it("extracts csrfToken from first element when body is an array", () => {
    const { req, res } = createMockReqRes({
      body: [{ csrfToken: VALID_TOKEN, start: "2024-01-01" }, { csrfToken: VALID_TOKEN }],
      cookies: { "calcom.csrf_token": VALID_TOKEN },
    });

    expect(() => validateCsrfTokenForPagesRouter(req, res)).not.toThrow();
  });

  it("throws 403 when body is an empty array", () => {
    const { req, res } = createMockReqRes({
      body: [],
      cookies: { "calcom.csrf_token": VALID_TOKEN },
    });

    expect(() => validateCsrfTokenForPagesRouter(req, res)).toThrow(HttpError);
  });

  it("clears the csrf cookie after successful validation", () => {
    const { req, res } = createMockReqRes({
      body: { csrfToken: VALID_TOKEN },
      cookies: { "calcom.csrf_token": VALID_TOKEN },
    });

    validateCsrfTokenForPagesRouter(req, res);

    expect(res.setHeader).toHaveBeenCalledWith(
      "Set-Cookie",
      "calcom.csrf_token=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax"
    );
  });
});
