import { NextRequest } from "next/server";
import { prisma, RoleStatus, UserRole } from "@techchain/db";
import { requireAuth, handleApiError, success, ApiError } from "@/lib/api";
import { hasPermission, isApprovedRecruiter, canAccessRole } from "@techchain/lib";
import { queueRecommender } from "@techchain/lib/src/queue";

// GET /api/roles/[id] - Get role details
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const ctx = await requireAuth();
    const { id } = params;

    const role = await prisma.role.findUnique({
      where: { id },
      include: {
        company: {
          select: { id: true, name: true, logoUrl: true, description: true },
        },
        _count: {
          select: { submissions: true, accesses: true },
        },
      },
    });

    if (!role) {
      throw new ApiError("Role not found", 404);
    }

    // Check access based on user role
    if (ctx.role === UserRole.PLATFORM_ADMIN) {
      // Admin can see everything
    } else if (ctx.role === UserRole.COMPANY_ADMIN || ctx.role === UserRole.COMPANY_USER) {
      // Check if role belongs to user's company
      const membership = await prisma.companyMember.findUnique({
        where: { userId: ctx.userId },
      });
      if (!membership || membership.companyId !== role.companyId) {
        throw new ApiError("Forbidden", 403);
      }
    } else if (ctx.role === UserRole.RECRUITER) {
      // Must be approved and have access
      if (!isApprovedRecruiter(ctx)) {
        throw new ApiError("Pending approval", 403);
      }

      if (role.status !== RoleStatus.LIVE) {
        throw new ApiError("Role not available", 404);
      }

      // Check access
      const recruiterProfile = await prisma.recruiterProfile.findUnique({
        where: { userId: ctx.userId },
      });

      if (recruiterProfile) {
        const access = await prisma.roleAccess.findUnique({
          where: {
            roleId_recruiterId: {
              roleId: id,
              recruiterId: recruiterProfile.id,
            },
          },
        });

        const hasAccess = canAccessRole(ctx, role.accessModel, access?.status === "APPROVED");

        return success({
          ...role,
          myAccessStatus: access?.status || null,
          hasAccess,
        });
      }
    } else {
      throw new ApiError("Forbidden", 403);
    }

    return success(role);
  } catch (error) {
    return handleApiError(error);
  }
}

// PATCH /api/roles/[id] - Update role
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const ctx = await requireAuth();
    const { id } = params;
    const body = await request.json();

    // Check permission
    if (ctx.role !== UserRole.PLATFORM_ADMIN) {
      if (!hasPermission(ctx, "company:manage_roles")) {
        throw new ApiError("Forbidden", 403);
      }

      // Verify role belongs to user's company
      const membership = await prisma.companyMember.findUnique({
        where: { userId: ctx.userId },
      });

      const role = await prisma.role.findUnique({
        where: { id },
        select: { companyId: true },
      });

      if (!membership || !role || membership.companyId !== role.companyId) {
        throw new ApiError("Forbidden", 403);
      }
    }

    // Handle status changes
    const currentRole = await prisma.role.findUnique({ where: { id } });
    if (!currentRole) {
      throw new ApiError("Role not found", 404);
    }

    const updateData: any = { ...body };

    // If publishing, set publishedAt
    if (body.status === RoleStatus.LIVE && currentRole.status !== RoleStatus.LIVE) {
      updateData.publishedAt = new Date();

      // Queue recommender to find matching candidates
      await queueRecommender({ type: "find_matches", roleId: id });
    }

    const updated = await prisma.role.update({
      where: { id },
      data: updateData,
      include: {
        company: {
          select: { id: true, name: true },
        },
      },
    });

    return success(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

// DELETE /api/roles/[id] - Delete role (soft delete via cancel)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const ctx = await requireAuth();
    const { id } = params;

    if (!hasPermission(ctx, "company:manage_roles") && ctx.role !== UserRole.PLATFORM_ADMIN) {
      throw new ApiError("Forbidden", 403);
    }

    // Verify ownership if not admin
    if (ctx.role !== UserRole.PLATFORM_ADMIN) {
      const membership = await prisma.companyMember.findUnique({
        where: { userId: ctx.userId },
      });

      const role = await prisma.role.findUnique({
        where: { id },
        select: { companyId: true },
      });

      if (!membership || !role || membership.companyId !== role.companyId) {
        throw new ApiError("Forbidden", 403);
      }
    }

    // Soft delete by setting status to cancelled
    await prisma.role.update({
      where: { id },
      data: {
        status: RoleStatus.CANCELLED,
        closedAt: new Date(),
      },
    });

    return success({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
