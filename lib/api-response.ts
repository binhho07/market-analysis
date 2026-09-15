import { NextResponse } from "next/server";

export interface ApiError {
  message: string;
  code?: string;
  details?: unknown;
}

export interface ApiSuccess<T = unknown> {
  data: T;
  message?: string;
}

export function successResponse<T>(
  data: T,
  message?: string,
  status: number = 200
) {
  return NextResponse.json(
    {
      success: true,
      data,
      message,
    } as ApiSuccess<T>,
    { status }
  );
}

export function errorResponse(
  message: string,
  status: number = 400,
  code?: string,
  details?: unknown
) {
  return NextResponse.json(
    {
      success: false,
      error: {
        message,
        code,
        details,
      } as ApiError,
    },
    { status }
  );
}

export function rateLimitResponse(reset: number) {
  return NextResponse.json(
    {
      success: false,
      error: {
        message: "Rate limit exceeded. Please try again later.",
        code: "RATE_LIMIT_EXCEEDED",
      },
    },
    {
      status: 429,
      headers: {
        "X-RateLimit-Reset": reset.toString(),
        "Retry-After": Math.ceil((reset - Date.now()) / 1000).toString(),
      },
    }
  );
}

export function unauthorizedResponse(message: string = "Unauthorized") {
  return errorResponse(message, 401, "UNAUTHORIZED");
}

export function notFoundResponse(message: string = "Resource not found") {
  return errorResponse(message, 404, "NOT_FOUND");
}



