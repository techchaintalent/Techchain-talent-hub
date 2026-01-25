import { prisma, AssessmentRunStatus } from "@techchain/db";
import { getAIProvider, generateCryptoScore, generateEmployabilityPlan, generateRoleFitAssessment, generateEmbedding } from "./ai";
import { fetchGitHubProfile, analyzeGitHubTechStack } from "./github";
import { createHash } from "crypto";

export interface RunCandidateAssessmentParams {
  candidateId: string;
  triggeredBy: "candidate" | "admin" | "system";
  assessmentTypes?: string[];
}

export async function runCandidateAssessment(
  params: RunCandidateAssessmentParams
): Promise<string> {
  const { candidateId, triggeredBy, assessmentTypes = ["crypto_score", "tech_score", "employability_plan", "role_fit"] } = params;

  // Get candidate profile
  const candidate = await prisma.candidateProfile.findUnique({
    where: { id: candidateId },
    include: { user: true },
  });

  if (!candidate) {
    throw new Error("Candidate not found");
  }

  // Check consent
  if (!candidate.consentToProcess) {
    throw new Error("Candidate has not consented to processing");
  }

  // Create assessment run
  const run = await prisma.candidateAssessmentRun.create({
    data: {
      candidateId,
      triggeredBy,
      status: AssessmentRunStatus.QUEUED,
      assessmentTypes,
      inputHash: createInputHash(candidate),
    },
  });

  // Start the assessment (would normally be queued, but running inline for MVP)
  await executeAssessmentRun(run.id);

  return run.id;
}

function createInputHash(candidate: any): string {
  const content = JSON.stringify({
    resumeText: candidate.resumeTextSnapshot,
    desiredRoles: candidate.desiredRoleTitles,
    interests: candidate.cryptoInterests,
    linkedin: candidate.linkedinAboutPaste,
    github: candidate.githubUrl,
  });
  return createHash("sha256").update(content).digest("hex").slice(0, 16);
}

export async function executeAssessmentRun(runId: string): Promise<void> {
  const run = await prisma.candidateAssessmentRun.findUnique({
    where: { id: runId },
    include: { candidate: true },
  });

  if (!run) {
    throw new Error("Assessment run not found");
  }

  // Update status to running
  await prisma.candidateAssessmentRun.update({
    where: { id: runId },
    data: { status: AssessmentRunStatus.RUNNING, startedAt: new Date() },
  });

  try {
    const candidate = run.candidate;
    const assessmentTypes = run.assessmentTypes || [];

    // Run crypto score assessment
    if (assessmentTypes.includes("crypto_score")) {
      await runCryptoScoreAssessment(runId, candidate);
    }

    // Run tech score assessment
    if (assessmentTypes.includes("tech_score") && candidate.consentToAnalyzeGithub && candidate.githubUrl) {
      await runTechScoreAssessment(runId, candidate);
    }

    // Run employability plan
    if (assessmentTypes.includes("employability_plan")) {
      await runEmployabilityPlanAssessment(runId, candidate);
    }

    // Run role fit assessments
    if (assessmentTypes.includes("role_fit")) {
      await runRoleFitAssessments(runId, candidate);
    }

    // Generate embedding for candidate
    if (candidate.resumeTextSnapshot) {
      const embedding = await generateEmbedding(candidate.resumeTextSnapshot);
      // Store embedding (would need raw SQL for pgvector)
      // For MVP, we'll skip the actual pgvector storage
    }

    // Update run as succeeded
    await prisma.candidateAssessmentRun.update({
      where: { id: runId },
      data: {
        status: AssessmentRunStatus.SUCCEEDED,
        completedAt: new Date(),
        provider: "mock", // or actual provider
        model: "gpt-4-turbo-preview",
      },
    });
  } catch (error: any) {
    await prisma.candidateAssessmentRun.update({
      where: { id: runId },
      data: {
        status: AssessmentRunStatus.FAILED,
        completedAt: new Date(),
        error: error.message,
      },
    });
    throw error;
  }
}

async function runCryptoScoreAssessment(runId: string, candidate: any): Promise<void> {
  const result = await generateCryptoScore(
    candidate.resumeTextSnapshot || "",
    candidate.linkedinAboutPaste,
    candidate.tweetSamplesPaste
  );

  await prisma.candidateCryptoScore.create({
    data: {
      candidateId: candidate.id,
      runId,
      cryptoNativeScore: result.cryptoNativeScore,
      rationale: result.rationale,
      confidence: result.confidence,
      flags: result.flags,
    },
  });
}

async function runTechScoreAssessment(runId: string, candidate: any): Promise<void> {
  // Extract GitHub username from URL
  const githubUrl = candidate.githubUrl;
  const match = githubUrl?.match(/github\.com\/([^\/]+)/);
  const username = match?.[1];

  if (!username) {
    console.log("Could not extract GitHub username");
    return;
  }

  try {
    const profile = await fetchGitHubProfile(username);
    const techStack = await analyzeGitHubTechStack(username);

    // Convert language percentages to scores (0-100)
    const scores: Record<string, number> = {};
    let totalRepos = 0;

    for (const [lang, count] of Object.entries(techStack)) {
      scores[lang] = Math.min(100, (count as number) * 15); // Scale repos to score
      totalRepos += count as number;
    }

    const overallScore = Math.min(100, totalRepos * 5 + (profile.public_repos || 0) * 2);

    await prisma.candidateTechScore.create({
      data: {
        candidateId: candidate.id,
        runId,
        scoresJson: scores,
        overallScore,
        githubUsername: username,
        reposAnalyzed: totalRepos,
      },
    });
  } catch (error) {
    console.error("Error analyzing GitHub:", error);
    // Continue without GitHub analysis
  }
}

async function runEmployabilityPlanAssessment(runId: string, candidate: any): Promise<void> {
  // Get latest crypto score for context
  const cryptoScore = await prisma.candidateCryptoScore.findFirst({
    where: { candidateId: candidate.id },
    orderBy: { createdAt: "desc" },
  });

  // Get latest tech scores
  const techScore = await prisma.candidateTechScore.findFirst({
    where: { candidateId: candidate.id },
    orderBy: { createdAt: "desc" },
  });

  const plan = await generateEmployabilityPlan(
    candidate.resumeTextSnapshot || "",
    candidate.desiredRoleTitles || [],
    candidate.cryptoInterests || [],
    cryptoScore
      ? { score: cryptoScore.cryptoNativeScore, rationale: cryptoScore.rationale }
      : undefined,
    techScore?.scoresJson as Record<string, number> | undefined
  );

  await prisma.candidateEmployabilityPlan.create({
    data: {
      candidateId: candidate.id,
      runId,
      planJson: plan,
    },
  });
}

async function runRoleFitAssessments(runId: string, candidate: any): Promise<void> {
  const desiredRoles = candidate.desiredRoleTitles || [];

  // Get archetypes for matching
  const archetypes = await prisma.roleFitArchetype.findMany({
    where: {
      archetypeName: { in: desiredRoles },
    },
  });

  const archetypeMap = new Map(
    archetypes.map((a) => [a.archetypeName, a.description])
  );

  for (const roleTitle of desiredRoles) {
    const archetypeDescription = archetypeMap.get(roleTitle);

    const assessment = await generateRoleFitAssessment(
      candidate.resumeTextSnapshot || "",
      roleTitle,
      archetypeDescription
    );

    await prisma.candidateRoleFitAssessment.create({
      data: {
        candidateId: candidate.id,
        runId,
        desiredRoleTitle: roleTitle,
        fitScore: assessment.fitScore,
        reasonsJson: {
          whyFit: assessment.whyFit,
          missingSkills: assessment.missingSkills,
          recommendedNextSteps: assessment.recommendedNextSteps,
        },
      },
    });
  }
}

// Scoring for recruiter submissions
export interface ScoreSubmissionParams {
  submissionId: string;
}

export async function scoreSubmission(params: ScoreSubmissionParams): Promise<void> {
  const { submissionId } = params;

  const submission = await prisma.candidateSubmission.findUnique({
    where: { id: submissionId },
    include: {
      role: true,
    },
  });

  if (!submission) {
    throw new Error("Submission not found");
  }

  // Check if candidate consent is given
  if (!submission.candidateConsent) {
    throw new Error("Candidate consent not provided");
  }

  // Generate crypto score
  const cryptoResult = await generateCryptoScore(submission.resumeText || "");

  // Generate role fit assessment
  const roleTitle = submission.role.title;
  const roleDescription = submission.role.description;

  const roleFit = await generateRoleFitAssessment(
    submission.resumeText || "",
    roleTitle,
    roleDescription
  );

  // GitHub analysis if provided
  let techScores: Record<string, number> | null = null;
  let techOverallScore: number | null = null;

  if (submission.candidateGithub) {
    const match = submission.candidateGithub.match(/github\.com\/([^\/]+)/);
    const username = match?.[1];

    if (username) {
      try {
        const techStack = await analyzeGitHubTechStack(username);
        techScores = {};
        let total = 0;

        for (const [lang, count] of Object.entries(techStack)) {
          techScores[lang] = Math.min(100, (count as number) * 15);
          total += count as number;
        }

        techOverallScore = Math.min(100, total * 5);
      } catch (error) {
        console.error("Error analyzing GitHub for submission:", error);
      }
    }
  }

  // Create or update scoring record
  await prisma.candidateScoring.upsert({
    where: { submissionId },
    create: {
      submissionId,
      cryptoNativeScore: cryptoResult.cryptoNativeScore,
      cryptoScoreRationale: cryptoResult.rationale,
      cryptoScoreConfidence: cryptoResult.confidence,
      techScores,
      techOverallScore,
      roleFitScore: roleFit.fitScore,
      roleFitRationale: JSON.stringify({
        whyFit: roleFit.whyFit,
        missingSkills: roleFit.missingSkills,
      }),
    },
    update: {
      cryptoNativeScore: cryptoResult.cryptoNativeScore,
      cryptoScoreRationale: cryptoResult.rationale,
      cryptoScoreConfidence: cryptoResult.confidence,
      techScores,
      techOverallScore,
      roleFitScore: roleFit.fitScore,
      roleFitRationale: JSON.stringify({
        whyFit: roleFit.whyFit,
        missingSkills: roleFit.missingSkills,
      }),
    },
  });
}

// Calculate profile completeness
export function calculateProfileCompleteness(candidate: any): number {
  let score = 0;
  const weights = {
    fullName: 10,
    location: 5,
    timezone: 5,
    desiredRoleTitles: 15,
    experienceLevel: 10,
    availability: 5,
    cryptoInterests: 10,
    resumeUrl: 20,
    linkedinUrl: 5,
    githubUrl: 10,
    consentToProcess: 5,
  };

  if (candidate.fullName) score += weights.fullName;
  if (candidate.location) score += weights.location;
  if (candidate.timezone) score += weights.timezone;
  if (candidate.desiredRoleTitles?.length > 0) score += weights.desiredRoleTitles;
  if (candidate.experienceLevel) score += weights.experienceLevel;
  if (candidate.availability) score += weights.availability;
  if (candidate.cryptoInterests?.length > 0) score += weights.cryptoInterests;
  if (candidate.resumeUrl) score += weights.resumeUrl;
  if (candidate.linkedinUrl) score += weights.linkedinUrl;
  if (candidate.githubUrl) score += weights.githubUrl;
  if (candidate.consentToProcess) score += weights.consentToProcess;

  return Math.min(100, score);
}
