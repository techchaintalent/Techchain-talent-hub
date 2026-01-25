import { NextRequest } from "next/server";
import { prisma, RecruiterStatus, UserRole } from "@techchain/db";
import { requireAuth, handleApiError, success, ApiError } from "@/lib/api";
import { sendRecruiterApprovalEmail } from "@techchain/lib";

// GET /api/admin/recruiters - List recruiters (admin only)
export async function GET(request: NextRequest) {
  try {
    const ctx = await requireAuth();

    if (ctx.role !== UserRole.PLATFORM_ADMIN) {
      throw new ApiError("Forbidden", 403);
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") as RecruiterStatus | null;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    const where: any = {};
    if (status) where.status = status;

    const [recruiters, total] = await Promise.all([
      prisma.recruiterProfile.findMany({
        where,
        include: {
          user: {
            select: { id: true, email: true, name: true, createdAt: true },
          },
          _count: {
            select: { submissions: true, commissions: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.recruiterProfile.count({ where }),
    ]);

    return success({ recruiters, total, page, limit });
  } catch (error) {
    return handleApiError(error);
  }
}

// PATCH /api/admin/recruiters - Approve or reject a recruiter
export async function PATCH(request: NextRequest) {
  try {
    const ctx = await requireAuth();

    if (ctx.role !== UserRole.PLATFORM_ADMIN) {
      throw new ApiError("Forbidden", 403);
    }

    const body = await request.json();
    const { recruiterId, action, reason } = body;

    if (!recruiterId || !action) {
      throw new ApiError("recruiterId and action are required", 400);
    }

    if (!["approve", "reject"].includes(action)) {
      throw new ApiError("Invalid action", 400);
    }

    const recruiter = await prisma.recruiterProfile.findUnique({
      where: { id: recruiterId },
      include: {
        user: { select: { email: true, name: true } },
      },
    });

    if (!recruiter) {
      throw new ApiError("Recruiter not found", 404);
    }

    if (recruiter.status !== RecruiterStatus.PENDING_APPROVAL) {
      throw new ApiError("Recruiter is not pending approval", 400);
    }

    const updateData: any = {};

    if (action === "approve") {
      updateData.status = RecruiterStatus.APPROVED;
      updateData.approvedAt = new Date();
      updateData.approvedBy = ctx.userId;
    } else {
      updateData.status = RecruiterStatus.REJECTED;
      updateData.rejectedAt = new Date();
      updateData.rejectedBy = ctx.userId;
      updateData.rejectionReason = reason;
    }

    const updated = await prisma.recruiterProfile.update({
      where: { id: recruiterId },
      data: updateData,
    });

    // Log admin action
    await prisma.adminAction.create({
      data: {
        adminId: ctx.userId,
        action: action === "approve" ? "approve_recruiter" : "reject_recruiter",
        targetType: "RecruiterProfile",
        targetId: recruiterId,
        reason,
      },
    });

    // Send email notification
    await sendRecruiterApprovalEmail(
      recruiter.user.email,
      recruiter.fullName || recruiter.user.name || "Recruiter",
      action === "approve",
      reason
    );

    return success({ recruiter: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
