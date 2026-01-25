import { NextRequest } from "next/server";
import { prisma, UserRole, CandidateProfileStatus, AvailabilityType } from "@techchain/db";
import { requireAuth, handleApiError, success, ApiError } from "@/lib/api";
import {
  CandidateProfileSchema,
  CandidateConsentSchema,
  calculateProfileCompleteness,
  queueAssessment,
} from "@techchain/lib";

// GET /api/candidates/profile - Get current user's candidate profile
export async function GET(request: NextRequest) {
  try {
    const ctx = await requireAuth();

    const profile = await prisma.candidateProfile.findUnique({
      where: { userId: ctx.userId },
      include: {
        user: {
          select: { id: true, email: true, name: true, emailVerified: true },
        },
        verification: true,
        cryptoScores: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        techScores: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        employabilityPlans: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        roleFitAssessments: {
          orderBy: { createdAt: "desc" },
        },
        assessmentRuns: {
          orderBy: { createdAt: "desc" },
          take: 5,
        },
      },
    });

    if (!profile) {
      // Return null to indicate no profile exists yet
      return success({ profile: null });
    }

    return success({ profile });
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/candidates/profile - Create candidate profile
export async function POST(request: NextRequest) {
  try {
    const ctx = await requireAuth();
    const body = await request.json();

    // Check if profile already exists
    const existingProfile = await prisma.candidateProfile.findUnique({
      where: { userId: ctx.userId },
    });

    if (existingProfile) {
      throw new ApiError("Profile already exists. Use PATCH to update.", 400);
    }

    // Parse and validate profile data
    const profileData = CandidateProfileSchema.parse(body.profile || body);

    // Parse consent data
    const consentData = CandidateConsentSchema.parse(body.consent || {
      consentToProcess: body.consentToProcess || false,
      consentToAnalyzeFootprint: body.consentToAnalyzeFootprint || false,
      consentToAnalyzeGithub: body.consentToAnalyzeGithub || false,
      consentToBeContacted: body.consentToBeContacted || false,
    });

    // Update user role to candidate if not already
    await prisma.user.update({
      where: { id: ctx.userId },
      data: { role: UserRole.CANDIDATE },
    });

    // Create profile
    const profile = await prisma.candidateProfile.create({
      data: {
        userId: ctx.userId,
        ...profileData,
        availability: profileData.availability as AvailabilityType,
        ...consentData,
        consentToProcessAt: consentData.consentToProcess ? new Date() : null,
        status: CandidateProfileStatus.ACTIVE,
        completenessScore: 0, // Will be calculated
      },
    });

    // Calculate completeness
    const completeness = calculateProfileCompleteness(profile);
    await prisma.candidateProfile.update({
      where: { id: profile.id },
      data: { completenessScore: completeness },
    });

    // Create verification record
    await prisma.candidateVerification.create({
      data: {
        candidateId: profile.id,
      },
    });

    return success({ profile: { ...profile, completenessScore: completeness } }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

// PATCH /api/candidates/profile - Update candidate profile
export async function PATCH(request: NextRequest) {
  try {
    const ctx = await requireAuth();
    const body = await request.json();

    const profile = await prisma.candidateProfile.findUnique({
      where: { userId: ctx.userId },
    });

    if (!profile) {
      throw new ApiError("Profile not found. Create one first.", 404);
    }

    // Partial update - only validate provided fields
    const updateData: any = {};

    // Profile fields
    const profileFields = [
      "fullName", "location", "timezone", "phone",
      "desiredRoleTitles", "experienceLevel", "availability", "remotePreference",
      "salaryExpectation", "cryptoInterests",
      "linkedinUrl", "githubUrl", "twitterUrl", "websiteUrl",
      "linkedinAboutPaste", "tweetSamplesPaste",
      "resumeUrl", "resumeTextSnapshot",
    ];

    for (const field of profileFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    // Consent fields - only update if explicitly provided
    if (body.consentToProcess !== undefined) {
      updateData.consentToProcess = body.consentToProcess;
      if (body.consentToProcess && !profile.consentToProcessAt) {
        updateData.consentToProcessAt = new Date();
      }
    }

    if (body.consentToAnalyzeFootprint !== undefined) {
      updateData.consentToAnalyzeFootprint = body.consentToAnalyzeFootprint;
    }

    if (body.consentToAnalyzeGithub !== undefined) {
      updateData.consentToAnalyzeGithub = body.consentToAnalyzeGithub;
    }

    if (body.consentToBeContacted !== undefined) {
      updateData.consentToBeContacted = body.consentToBeContacted;
    }

    // Discoverability requires consent to be contacted
    if (body.discoverable !== undefined) {
      if (body.discoverable && !profile.consentToBeContacted && !body.consentToBeContacted) {
        throw new ApiError("Must consent to be contacted to be discoverable", 400);
      }
      updateData.discoverable = body.discoverable;
    }

    const updated = await prisma.candidateProfile.update({
      where: { id: profile.id },
      data: updateData,
    });

    // Recalculate completeness
    const completeness = calculateProfileCompleteness(updated);
    await prisma.candidateProfile.update({
      where: { id: profile.id },
      data: { completenessScore: completeness },
    });

    return success({ profile: { ...updated, completenessScore: completeness } });
  } catch (error) {
    return handleApiError(error);
  }
}
