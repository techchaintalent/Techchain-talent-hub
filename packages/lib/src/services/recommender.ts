import { prisma, RoleStatus, CandidateProfileStatus } from "@techchain/db";
import { generateEmbedding } from "./ai";

export interface MatchResult {
  candidateType: "community" | "submission";
  candidateId?: string;
  submissionId?: string;
  candidateName: string;
  candidateEmail: string;
  matchScore: number;
  matchReasons: string[];
  isDiscoverable: boolean;
}

export async function findHiddenTalentForRole(roleId: string): Promise<MatchResult[]> {
  const role = await prisma.role.findUnique({
    where: { id: roleId },
    include: { company: true },
  });

  if (!role) {
    throw new Error("Role not found");
  }

  const matches: MatchResult[] = [];

  // 1. Match against community candidates
  const communityCandidates = await findCommunityMatches(role);
  matches.push(...communityCandidates);

  // 2. Match against previous submissions (from other roles)
  const submissionCandidates = await findSubmissionMatches(role);
  matches.push(...submissionCandidates);

  // Sort by match score
  matches.sort((a, b) => b.matchScore - a.matchScore);

  // Store matches in database
  for (const match of matches.slice(0, 20)) {
    await prisma.hiddenTalentMatch.upsert({
      where: match.candidateId
        ? { roleId_candidateProfileId: { roleId, candidateProfileId: match.candidateId } }
        : { roleId_submissionId: { roleId, submissionId: match.submissionId! } },
      create: {
        roleId,
        candidateProfileId: match.candidateId,
        submissionId: match.submissionId,
        matchScore: match.matchScore,
        matchReasons: match.matchReasons,
      },
      update: {
        matchScore: match.matchScore,
        matchReasons: match.matchReasons,
      },
    });
  }

  return matches.slice(0, 20);
}

async function findCommunityMatches(role: any): Promise<MatchResult[]> {
  // Get active community candidates
  const candidates = await prisma.candidateProfile.findMany({
    where: {
      status: CandidateProfileStatus.ACTIVE,
      consentToProcess: true,
    },
    include: {
      user: true,
      cryptoScores: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      techScores: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    take: 100,
  });

  const matches: MatchResult[] = [];

  for (const candidate of candidates) {
    const { score, reasons } = calculateCommunityMatchScore(candidate, role);

    if (score > 0.3) {
      matches.push({
        candidateType: "community",
        candidateId: candidate.id,
        candidateName: candidate.fullName || candidate.user.name || "Unknown",
        candidateEmail: candidate.user.email,
        matchScore: score,
        matchReasons: reasons,
        isDiscoverable: candidate.discoverable,
      });
    }
  }

  return matches;
}

function calculateCommunityMatchScore(
  candidate: any,
  role: any
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  // Check desired role titles match
  const desiredRoles = candidate.desiredRoleTitles || [];
  const roleTitle = role.title.toLowerCase();

  for (const desired of desiredRoles) {
    const desiredLower = desired.toLowerCase();
    if (
      roleTitle.includes(desiredLower) ||
      desiredLower.includes(roleTitle.split(" ")[0])
    ) {
      score += 0.25;
      reasons.push(`Desired role "${desired}" matches role title`);
      break;
    }
  }

  // Check crypto interests alignment
  const candidateInterests = candidate.cryptoInterests || [];
  const roleTags = role.cryptoTags || [];

  const matchingInterests = candidateInterests.filter((i: string) =>
    roleTags.some((t: string) => t.toLowerCase().includes(i.toLowerCase()))
  );

  if (matchingInterests.length > 0) {
    score += 0.15 * Math.min(matchingInterests.length, 3);
    reasons.push(`Crypto interests align: ${matchingInterests.join(", ")}`);
  }

  // Check tech stack alignment
  const roleTech = role.techStack || [];
  const candidateTech = candidate.techScores?.[0]?.scoresJson || {};

  const techMatches = roleTech.filter((tech: string) =>
    Object.keys(candidateTech).some(
      (t) => t.toLowerCase() === tech.toLowerCase()
    )
  );

  if (techMatches.length > 0) {
    score += 0.2 * Math.min(techMatches.length / Math.max(roleTech.length, 1), 1);
    reasons.push(`Tech stack matches: ${techMatches.join(", ")}`);
  }

  // Crypto score bonus
  const cryptoScore = candidate.cryptoScores?.[0]?.cryptoNativeScore;
  if (cryptoScore) {
    if (cryptoScore >= 70) {
      score += 0.15;
      reasons.push(`Strong crypto-native profile (${cryptoScore}/100)`);
    } else if (cryptoScore >= 50) {
      score += 0.08;
      reasons.push(`Moderate crypto-native profile (${cryptoScore}/100)`);
    }
  }

  // Experience level match
  if (candidate.experienceLevel && role.experienceLevel) {
    if (candidate.experienceLevel.toLowerCase() === role.experienceLevel.toLowerCase()) {
      score += 0.1;
      reasons.push("Experience level matches");
    }
  }

  // Remote preference match
  if (candidate.remotePreference && role.locationType) {
    const isRemoteRole = role.locationType === "REMOTE";
    const prefersRemote = candidate.remotePreference === "remote";

    if (isRemoteRole && prefersRemote) {
      score += 0.05;
      reasons.push("Remote preference matches");
    }
  }

  return { score: Math.min(score, 1), reasons };
}

async function findSubmissionMatches(role: any): Promise<MatchResult[]> {
  // Get submissions from other roles that might be good fits
  const submissions = await prisma.candidateSubmission.findMany({
    where: {
      roleId: { not: role.id },
      status: { notIn: ["REJECTED", "WITHDRAWN"] },
      candidateConsent: true,
    },
    include: {
      role: true,
      scoring: true,
    },
    take: 50,
  });

  const matches: MatchResult[] = [];

  for (const submission of submissions) {
    const { score, reasons } = calculateSubmissionMatchScore(submission, role);

    if (score > 0.4) {
      matches.push({
        candidateType: "submission",
        submissionId: submission.id,
        candidateName: submission.candidateName,
        candidateEmail: submission.candidateEmail,
        matchScore: score,
        matchReasons: reasons,
        isDiscoverable: false, // Submissions are not discoverable
      });
    }
  }

  return matches;
}

function calculateSubmissionMatchScore(
  submission: any,
  role: any
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  // Check if previous role was similar
  const prevRole = submission.role;

  // Title similarity
  const prevTitle = prevRole.title.toLowerCase();
  const newTitle = role.title.toLowerCase();

  const titleWords = new Set(prevTitle.split(/\s+/));
  const newTitleWords = newTitle.split(/\s+/);

  const matchingWords = newTitleWords.filter((w: string) => titleWords.has(w));
  if (matchingWords.length > 0) {
    score += 0.3 * (matchingWords.length / newTitleWords.length);
    reasons.push(`Similar role title (previously applied to: ${prevRole.title})`);
  }

  // Tech stack overlap
  const prevTech = new Set(prevRole.techStack || []);
  const newTech = role.techStack || [];

  const techOverlap = newTech.filter((t: string) => prevTech.has(t));
  if (techOverlap.length > 0) {
    score += 0.2 * Math.min(techOverlap.length / Math.max(newTech.length, 1), 1);
    reasons.push(`Tech stack overlap: ${techOverlap.join(", ")}`);
  }

  // Crypto tags overlap
  const prevTags = new Set(prevRole.cryptoTags || []);
  const newTags = role.cryptoTags || [];

  const tagOverlap = newTags.filter((t: string) => prevTags.has(t));
  if (tagOverlap.length > 0) {
    score += 0.15;
    reasons.push(`Domain overlap: ${tagOverlap.join(", ")}`);
  }

  // Scoring from previous submission
  const scoring = submission.scoring;
  if (scoring) {
    if (scoring.cryptoNativeScore >= 70) {
      score += 0.15;
      reasons.push(`High crypto-native score (${scoring.cryptoNativeScore}/100)`);
    }

    if (scoring.roleFitScore && scoring.roleFitScore >= 70) {
      score += 0.1;
      reasons.push(`Strong role fit in previous application`);
    }
  }

  // Status bonus (further in process = better)
  const statusBonus: Record<string, number> = {
    INTERVIEWING: 0.1,
    OFFER: 0.15,
  };

  if (statusBonus[submission.status]) {
    score += statusBonus[submission.status];
    reasons.push(`Strong progress in previous application (${submission.status})`);
  }

  return { score: Math.min(score, 1), reasons };
}

export async function getHiddenTalentMatches(roleId: string): Promise<any[]> {
  return prisma.hiddenTalentMatch.findMany({
    where: { roleId },
    orderBy: { matchScore: "desc" },
    take: 20,
  });
}

export async function markMatchViewed(matchId: string): Promise<void> {
  await prisma.hiddenTalentMatch.update({
    where: { id: matchId },
    data: {
      viewedByAdmin: true,
      viewedAt: new Date(),
    },
  });
}

export async function recordMatchAction(
  matchId: string,
  action: string
): Promise<void> {
  await prisma.hiddenTalentMatch.update({
    where: { id: matchId },
    data: { actionTaken: action },
  });
}
