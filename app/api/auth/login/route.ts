import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyPassword, generateToken } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate input
    const result = loginSchema.safeParse(body);
    if (!result.success) {
      return errorResponse(
        "Validation error",
        400,
        "VALIDATION_ERROR",
        result.error.issues
      );
    }

    const { email, password } = result.data;

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return errorResponse(
        "Invalid email or password",
        401,
        "INVALID_CREDENTIALS"
      );
    }

    // Verify password
    const isValidPassword = await verifyPassword(password, user.passwordHash);

    if (!isValidPassword) {
      return errorResponse(
        "Invalid email or password",
        401,
        "INVALID_CREDENTIALS"
      );
    }

    // Generate JWT token
    const token = generateToken({
      userId: user.id,
      email: user.email,
      subscriptionTier: user.subscriptionTier,
    });

    return successResponse({
      user: {
        id: user.id,
        email: user.email,
        salonName: user.salonName,
        salonAddress: user.salonAddress,
        subscriptionTier: user.subscriptionTier,
        createdAt: user.createdAt,
      },
      token,
    }, "Login successful");
  } catch (error) {
    console.error("Login error:", error);
    return errorResponse(
      "Failed to login",
      500,
      "INTERNAL_ERROR"
    );
  }
}



