import { NextRequest } from "next/server";
import { prisma, UserRole, SubmissionStatus } from "@techchain/db";
import { requireAuth, handleApiError, success, ApiError } from "@/lib/api";
import {
  isApprovedRecruiter,
  hasPermission,
  canAccessRole,
  SubmissionSchema,
  queueAssessment,
  generateCandidateSummary,
} from "@techchain/lib";

// GET /api/submissions - List submissions
export async function GET(request: NextRequest) {
  try {
    const ctx = await requireAuth();
    const { searchParams } = new URL(request.url);

    const roleId = searchParams.get("roleId");
    const status = searchParams.get("status") as SubmissionStatus | null;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    const where: any = {};

    if (ctx.role === UserRole.RECRUITER) {
      // Recruiters can only see their own submissions
      const recruiterProfile = await prisma.recruiterProfile.findUnique({
        where: { userId: ctx.userId },
      });

      if (!recruiterProfile) {
        throw new ApiError("Recruiter profile not found", 400);
      }

      where.recruiterId = recruiterProfile.id;
    } else if (ctx.role === UserRole.COMPANY_ADMIN || ctx.role === UserRole.COMPANY_USER) {
      // Company users can see submissions for their roles
      where.role = {
        company: {
          members: { some: { userId: ctx.userId } },
        },
      };
    } else if (ctx.role !== UserRole.PLATFORM_ADMIN) {
      throw new ApiError("Forbidden", 403);
    }

    if (roleId) where.roleId = roleId;
    if (status) where.status = status;

    const [submissions, total] = await Promise.all([
      prisma.candidateSubmission.findMany({
        where,
        include: {
          role: {
            select: {
              id: true,
              title: true,
              company: { select: { id: true, name: true } },
            },
          },
          recruiter: {
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          },
          scoring: true,
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.candidateSubmission.count({ where }),
    ]);

    return success({ submissions, total, page, limit });
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/submissions - Create a new submission
export async function POST(request: NextRequest) {
  try {
    const ctx = await requireAuth();

    // Must be approved recruiter
    if (ctx.role !== UserRole.RECRUITER || !isApprovedRecruiter(ctx)) {
      throw new ApiError("Only approved recruiters can submit candidates", 403);
    }

    const body = await request.json();
    const { roleId, resumeUrl, resumeText, ...candidateData } = body;

    // Validate required fields
    if (!roleId) {
      throw new ApiError("roleId is required", 400);
    }

    if (!resumeUrl) {
      throw new ApiError("Resume is required", 400);
    }

    const data = SubmissionSchema.parse(candidateData);

    // Get recruiter profile
    const recruiterProfile = await prisma.recruiterProfile.findUnique({
      where: { userId: ctx.userId },
    });

    if (!recruiterProfile) {
      throw new ApiError("Recruiter profile not found", 400);
    }

    // Verify access to role
    const role = await prisma.role.findUnique({
      where: { id: roleId },
      select: { id: true, status: true, accessModel: true, title: true, description: true },
    });

    if (!role || role.status !== "LIVE") {
      throw new ApiError("Role not available", 404);
    }

    const access = await prisma.roleAccess.findUnique({
      where: {
        roleId_recruiterId: {
          roleId,
          recruiterId: recruiterProfile.id,
        },
      },
    });

    if (!canAccessRole(ctx, role.accessModel, access?.status === "APPROVED")) {
      throw new ApiError("You don't have access to this role", 403);
    }

    // Create submission
    const submission = await prisma.candidateSubmission.create({
      data: {
        roleId,
        recruiterId: recruiterProfile.id,
        ...data,
        resumeUrl,
        resumeText,
        consentTimestamp: new Date(),
        attestationTimestamp: new Date(),
        status: SubmissionStatus.SUBMITTED,
        statusHistory: JSON.stringify([
          {
            status: SubmissionStatus.SUBMITTED,
            timestamp: new Date().toISOString(),
            by: recruiterProfile.id,
          },
        ]),
      },
      include: {
        role: {
          select: { id: true, title: true },
        },
      },
    });

    // Queue AI summary generation
    try {
      const summary = await generateCandidateSummary(
        resumeText || "",
        role.title,
        role.description,
        data.screeningAnswers ? JSON.stringify(data.screeningAnswers) : undefined
      );

      await prisma.candidateSubmission.update({
        where: { id: submission.id },
        data: {
          aiSummary: `**Overall Fit: ${summary.overallFit} (${summary.fitScore}/100)**\n\n${summary.summary}\n\n**Strengths:**\n${summary.strengths.map(s => `- ${s}`).join("\n")}\n\n**Concerns:**\n${summary.concerns.map(c => `- ${c}`).join("\n")}`,
          aiSummaryGeneratedAt: new Date(),
        },
      });

      // Queue scoring job
      await queueAssessment({
        type: "submission_scoring",
        submissionId: submission.id,
        triggeredBy: "system",
      });
    } catch (error) {
      console.error("Error generating AI summary:", error);
      // Continue without summary - it can be generated later
    }

    return success(submission, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
