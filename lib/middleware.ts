import { NextRequest } from "next/server";
import { getUserFromToken } from "./auth";
import { checkRateLimit } from "./rate-limit";
import { unauthorizedResponse, rateLimitResponse } from "./api-response";

export interface AuthenticatedRequest extends NextRequest {
  user?: {
    id: string;
    email: string;
    salonName: string | null;
    salonAddress: string | null;
    subscriptionTier: string;
    createdAt: Date;
  };
}

export async function withAuth(
  request: NextRequest,
  handler: (req: AuthenticatedRequest) => Promise<Response>
): Promise<Response> {
  const authHeader = request.headers.get("authorization");
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return unauthorizedResponse("Missing or invalid authorization header");
  }

  const token = authHeader.substring(7);
  const user = await getUserFromToken(token);

  if (!user) {
    return unauthorizedResponse("Invalid or expired token");
  }

  // Attach user to request
  const authenticatedRequest = request as AuthenticatedRequest;
  authenticatedRequest.user = user;

  return handler(authenticatedRequest);
}

export async function withRateLimit(
  request: NextRequest,
  handler: (req: NextRequest) => Promise<Response>,
  requireAuth: boolean = true
): Promise<Response> {
  let userId: string;
  let tier: "free" | "pro" | "enterprise" = "free";

  if (requireAuth) {
    // Extract user from token
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return unauthorizedResponse("Missing or invalid authorization header");
    }

    const token = authHeader.substring(7);
    const user = await getUserFromToken(token);

    if (!user) {
      return unauthorizedResponse("Invalid or expired token");
    }

    userId = user.id;
    tier = user.subscriptionTier as "free" | "pro" | "enterprise";
  } else {
    // Use IP address for non-authenticated requests
    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded ? forwarded.split(",")[0] : "unknown";
    userId = `ip:${ip}`;
  }

  // Check rate limit
  const rateLimit = await checkRateLimit(userId, tier);

  if (!rateLimit.success) {
    return rateLimitResponse(rateLimit.reset);
  }

  // Add rate limit headers to response
  const response = await handler(request);
  
  response.headers.set("X-RateLimit-Limit", rateLimit.limit.toString());
  response.headers.set("X-RateLimit-Remaining", rateLimit.remaining.toString());
  response.headers.set("X-RateLimit-Reset", rateLimit.reset.toString());

  return response;
}

export async function withAuthAndRateLimit(
  request: NextRequest,
  handler: (req: AuthenticatedRequest) => Promise<Response>
): Promise<Response> {
  return withAuth(request, async (authenticatedRequest) => {
    return withRateLimit(
      authenticatedRequest,
      () => handler(authenticatedRequest),
      true
    );
  });
}



