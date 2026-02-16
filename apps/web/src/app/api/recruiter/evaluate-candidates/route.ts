import { NextRequest } from "next/server";
import { UserRole } from "@techchain/db";
import { requireAuth, handleApiError, success, ApiError } from "@/lib/api";
import {
  isApprovedRecruiter,
  EvaluationInputSchema,
  evaluateCandidates,
  validateRoleBriefCompleteness,
} from "@techchain/lib";

// POST /api/recruiter/evaluate-candidates
// Body: { roleBrief: TargetRoleBrief, candidates: CandidateSnippet[] }
export async function POST(request: NextRequest) {
  try {
    const ctx = await requireAuth();

    // Must be approved recruiter or platform admin
    if (
      ctx.role === UserRole.RECRUITER &&
      !isApprovedRecruiter(ctx)
    ) {
      throw new ApiError("Only approved recruiters can evaluate candidates", 403);
    }

    if (
      ctx.role !== UserRole.RECRUITER &&
      ctx.role !== UserRole.PLATFORM_ADMIN
    ) {
      throw new ApiError("Forbidden", 403);
    }

    const body = await request.json();

    // Validate input
    const input = EvaluationInputSchema.parse(body);

    // Check role brief completeness
    const validation = validateRoleBriefCompleteness(input.roleBrief);
    if (!validation.isComplete) {
      return success(
        {
          incomplete: true,
          missingFields: validation.missingFields,
          clarifyingQuestions: validation.clarifyingQuestions,
        },
        422
      );
    }

    // Run evaluation pipeline
    const result = await evaluateCandidates(input.roleBrief, input.candidates);

    return success(result);
  } catch (error) {
    return handleApiError(error);
  }
}
