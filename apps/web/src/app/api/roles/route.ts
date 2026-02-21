import { NextRequest, NextResponse } from "next/server";
import { prisma, RoleStatus, RoleAccessModel, UserRole } from "@techchain/db";
import { requireAuth, handleApiError, success, ApiError } from "@/lib/api";
import { hasPermission, isApprovedRecruiter, RoleSchema } from "@techchain/lib";

// GET /api/roles - List roles (with filtering based on user role)
export async function GET(request: NextRequest) {
  try {
    const ctx = await requireAuth();
    const { searchParams } = new URL(request.url);

    // Parse query params
    const status = searchParams.get("status") as RoleStatus | null;
    const search = searchParams.get("search");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    // Build where clause based on user role
    const where: any = {};

    if (ctx.role === UserRole.PLATFORM_ADMIN) {
      // Admin can see all roles
      if (status) where.status = status;
    } else if (ctx.role === UserRole.COMPANY_ADMIN || ctx.role === UserRole.COMPANY_USER) {
      // Company users can only see their company's roles
      where.company = { members: { some: { userId: ctx.userId } } };
      if (status) where.status = status;
    } else if (ctx.role === UserRole.RECRUITER) {
      // Recruiters must be approved to see marketplace
      if (!isApprovedRecruiter(ctx)) {
        return success({ roles: [], total: 0, message: "Pending approval" });
      }

      // Only show live roles
      where.status = RoleStatus.LIVE;
    } else {
      throw new ApiError("Forbidden", 403);
    }

    // Search filter
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { company: { name: { contains: search, mode: "insensitive" } } },
      ];
    }

    // Fetch roles with pagination
    const [roles, total] = await Promise.all([
      prisma.role.findMany({
        where,
        include: {
          company: {
            select: { id: true, name: true, logoUrl: true },
          },
          _count: {
            select: { submissions: true },
          },
        },
        orderBy: { publishedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.role.count({ where }),
    ]);

    // For recruiters, add their access status
    if (ctx.role === UserRole.RECRUITER) {
      const recruiterProfile = await prisma.recruiterProfile.findUnique({
        where: { userId: ctx.userId },
      });

      if (recruiterProfile) {
        const accesses = await prisma.roleAccess.findMany({
          where: {
            recruiterId: recruiterProfile.id,
            roleId: { in: roles.map((r) => r.id) },
          },
        });

        const accessMap = new Map(accesses.map((a) => [a.roleId, a.status]));

        const rolesWithAccess = roles.map((role) => ({
          ...role,
          myAccessStatus: accessMap.get(role.id) || null,
          hasAccess:
            role.accessModel === RoleAccessModel.OPEN ||
            accessMap.get(role.id) === "APPROVED",
        }));

        return success({ roles: rolesWithAccess, total, page, limit });
      }
    }

    return success({ roles, total, page, limit });
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/roles - Create a new role (company users only)
export async function POST(request: NextRequest) {
  try {
    const ctx = await requireAuth();

    if (!hasPermission(ctx, "company:manage_roles")) {
      throw new ApiError("Forbidden", 403);
    }

    const body = await request.json();
    const data = RoleSchema.parse(body);

    // Get user's company
    const membership = await prisma.companyMember.findUnique({
      where: { userId: ctx.userId },
    });

    if (!membership) {
      throw new ApiError("No company membership found", 400);
    }

    const role = await prisma.role.create({
      data: {
        ...data,
        companyId: membership.companyId,
        status: RoleStatus.DRAFT,
      },
      include: {
        company: {
          select: { id: true, name: true },
        },
      },
    });

    return success(role, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
