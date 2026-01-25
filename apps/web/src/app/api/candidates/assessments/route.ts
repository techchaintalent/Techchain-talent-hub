import { NextRequest } from "next/server";
import { prisma, AssessmentRunStatus } from "@techchain/db";
import { requireAuth, handleApiError, success, ApiError } from "@/lib/api";
import { runCandidateAssessment, queueAssessment } from "@techchain/lib";

// GET /api/candidates/assessments - Get assessment history
export async function GET(request: NextRequest) {
  try {
    const ctx = await requireAuth();

    const profile = await prisma.candidateProfile.findUnique({
      where: { userId: ctx.userId },
      select: { id: true },
    });

    if (!profile) {
      throw new ApiError("Profile not found", 404);
    }

    const assessments = await prisma.candidateAssessmentRun.findMany({
      where: { candidateId: profile.id },
      include: {
        employabilityPlan: true,
        roleFitAssessments: true,
        cryptoScore: true,
        techScore: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return success({ assessments });
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/candidates/assessments - Trigger new assessment run
export async function POST(request: NextRequest) {
  try {
    const ctx = await requireAuth();
    const body = await request.json();

    const profile = await prisma.candidateProfile.findUnique({
      where: { userId: ctx.userId },
    });

    if (!profile) {
      throw new ApiError("Profile not found. Create one first.", 404);
    }

    // Check consent
    if (!profile.consentToProcess) {
      throw new ApiError("You must consent to data processing to run assessments", 400);
    }

    // Check for recent assessment (rate limit: 1 per hour)
    const recentRun = await prisma.candidateAssessmentRun.findFirst({
      where: {
        candidateId: profile.id,
        createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
      },
      orderBy: { createdAt: "desc" },
    });

    if (recentRun && recentRun.status !== AssessmentRunStatus.FAILED) {
      throw new ApiError(
        "Please wait at least 1 hour between assessment runs",
        429
      );
    }

    // Determine which assessments to run
    const assessmentTypes = body.assessmentTypes || [
      "crypto_score",
      ...(profile.consentToAnalyzeGithub && profile.githubUrl ? ["tech_score"] : []),
      "employability_plan",
      "role_fit",
    ];

    // Create and run assessment
    const runId = await runCandidateAssessment({
      candidateId: profile.id,
      triggeredBy: "candidate",
      assessmentTypes,
    });

    const run = await prisma.candidateAssessmentRun.findUnique({
      where: { id: runId },
      include: {
        employabilityPlan: true,
        roleFitAssessments: true,
        cryptoScore: true,
        techScore: true,
      },
    });

    return success({ run }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
