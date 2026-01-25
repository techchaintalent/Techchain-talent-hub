import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions, getAuthContext, AuthContext } from "@techchain/lib";
import { ZodError } from "zod";

export async function getSession() {
  return getServerSession(authOptions);
}

export async function requireAuth(): Promise<AuthContext> {
  const session = await getSession();

  if (!session?.user?.id) {
    throw new ApiError("Unauthorized", 401);
  }

  return getAuthContext(session.user.id);
}

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
    public code?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function handleApiError(error: unknown): NextResponse {
  console.error("API Error:", error);

  if (error instanceof ApiError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.statusCode }
    );
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: "Validation failed", details: error.errors },
      { status: 400 }
    );
  }

  if (error instanceof Error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { error: "Internal server error" },
    { status: 500 }
  );
}

export function success<T>(data: T, status: number = 200): NextResponse {
  return NextResponse.json(data, { status });
}
