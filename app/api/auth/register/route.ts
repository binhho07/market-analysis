import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword, generateToken } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";

const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  salonName: z.string().optional(),
  salonAddress: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate input
    const result = registerSchema.safeParse(body);
    if (!result.success) {
      return errorResponse(
        "Validation error",
        400,
        "VALIDATION_ERROR",
        result.error.issues
      );
    }

    const { email, password, salonName, salonAddress } = result.data;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return errorResponse(
        "User with this email already exists",
        409,
        "USER_EXISTS"
      );
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        salonName,
        salonAddress,
        subscriptionTier: "free",
      },
      select: {
        id: true,
        email: true,
        salonName: true,
        salonAddress: true,
        subscriptionTier: true,
        createdAt: true,
      },
    });

    // Generate JWT token
    const token = generateToken({
      userId: user.id,
      email: user.email,
      subscriptionTier: user.subscriptionTier,
    });

    return successResponse(
      {
        user,
        token,
      },
      "User registered successfully",
      201
    );
  } catch (error) {
    console.error("Registration error:", error);
    return errorResponse(
      "Failed to register user",
      500,
      "INTERNAL_ERROR"
    );
  }
}



