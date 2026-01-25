import { NextRequest } from "next/server";
import { prisma, RoleAccessStatus, UserRole } from "@techchain/db";
import { requireAuth, handleApiError, success, ApiError } from "@/lib/api";
import { isApprovedRecruiter } from "@techchain/lib";

// POST /api/roles/[id]/access - Request access to a role
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const ctx = await requireAuth();
    const { id: roleId } = params;

    // Must be an approved recruiter
    if (ctx.role !== UserRole.RECRUITER || !isApprovedRecruiter(ctx)) {
      throw new ApiError("Only approved recruiters can request access", 403);
    }

    // Get recruiter profile
    const recruiterProfile = await prisma.recruiterProfile.findUnique({
      where: { userId: ctx.userId },
    });

    if (!recruiterProfile) {
      throw new ApiError("Recruiter profile not found", 400);
    }

    // Check if role exists and is live
    const role = await prisma.role.findUnique({
      where: { id: roleId },
      select: { id: true, status: true, accessModel: true },
    });

    if (!role || role.status !== "LIVE") {
      throw new ApiError("Role not available", 404);
    }

    // Check if access already exists
    const existingAccess = await prisma.roleAccess.findUnique({
      where: {
        roleId_recruiterId: {
          roleId,
          recruiterId: recruiterProfile.id,
        },
      },
    });

    if (existingAccess) {
      return success({ access: existingAccess });
    }

    // Create access request
    const access = await prisma.roleAccess.create({
      data: {
        roleId,
        recruiterId: recruiterProfile.id,
        status:
          role.accessModel === "OPEN"
            ? RoleAccessStatus.APPROVED
            : RoleAccessStatus.PENDING,
      },
    });

    return success({ access }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

// GET /api/roles/[id]/access - Get access requests for a role (company/admin)
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const ctx = await requireAuth();
    const { id: roleId } = params;

    // Verify permission
    if (ctx.role !== UserRole.PLATFORM_ADMIN) {
      const membership = await prisma.companyMember.findUnique({
        where: { userId: ctx.userId },
      });

      const role = await prisma.role.findUnique({
        where: { id: roleId },
        select: { companyId: true },
      });

      if (!membership || !role || membership.companyId !== role.companyId) {
        throw new ApiError("Forbidden", 403);
      }
    }

    const accesses = await prisma.roleAccess.findMany({
      where: { roleId },
      include: {
        recruiter: {
          include: {
            user: {
              select: { id: true, email: true, name: true },
            },
          },
        },
      },
      orderBy: { requestedAt: "desc" },
    });

    return success({ accesses });
  } catch (error) {
    return handleApiError(error);
  }
}

// PATCH /api/roles/[id]/access - Update access status (approve/reject)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const ctx = await requireAuth();
    const { id: roleId } = params;
    const body = await request.json();
    const { recruiterId, status } = body;

    if (!recruiterId || !status) {
      throw new ApiError("recruiterId and status are required", 400);
    }

    if (!["APPROVED", "REJECTED", "REVOKED"].includes(status)) {
      throw new ApiError("Invalid status", 400);
    }

    // Verify permission
    if (ctx.role !== UserRole.PLATFORM_ADMIN) {
      const membership = await prisma.companyMember.findUnique({
        where: { userId: ctx.userId },
      });

      const role = await prisma.role.findUnique({
        where: { id: roleId },
        select: { companyId: true },
      });

      if (!membership || !role || membership.companyId !== role.companyId) {
        throw new ApiError("Forbidden", 403);
      }
    }

    const access = await prisma.roleAccess.update({
      where: {
        roleId_recruiterId: {
          roleId,
          recruiterId,
        },
      },
      data: {
        status,
        respondedAt: new Date(),
        respondedBy: ctx.userId,
      },
    });

    return success({ access });
  } catch (error) {
    return handleApiError(error);
  }
}
