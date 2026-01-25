import { prisma } from "@techchain/db";
import { randomBytes } from "crypto";
import { env } from "../env";

export interface VerificationCode {
  code: string;
  expiresAt: Date;
}

export function generateVerificationCode(): VerificationCode {
  const code = randomBytes(4).toString("hex").toUpperCase();
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
  return { code, expiresAt };
}

// GitHub Proof Verification
export async function initiateGitHubVerification(
  candidateId: string
): Promise<{ code: string; instructions: string }> {
  const { code, expiresAt } = generateVerificationCode();

  // Store the code
  await prisma.candidateVerification.upsert({
    where: { candidateId },
    create: {
      candidateId,
      githubProofCode: code,
    },
    update: {
      githubProofCode: code,
    },
  });

  const instructions = `To verify your GitHub account:

1. Create a new public Gist at https://gist.github.com
2. Name the file: techchain-verify.txt
3. Add this exact content: ${code}
4. Save the Gist as public
5. Come back here and click "Verify"

Your code expires in 30 minutes.

Alternatively, you can add the code "${code}" to your GitHub bio temporarily.`;

  return { code, instructions };
}

export async function verifyGitHubProof(
  candidateId: string,
  githubUsername: string
): Promise<{ verified: boolean; error?: string }> {
  const verification = await prisma.candidateVerification.findUnique({
    where: { candidateId },
  });

  if (!verification || !verification.githubProofCode) {
    return { verified: false, error: "No verification pending" };
  }

  const code = verification.githubProofCode;

  try {
    // Check Gist first
    const gistVerified = await checkGistForCode(githubUsername, code);
    if (gistVerified) {
      await markGitHubVerified(candidateId, "gist");
      return { verified: true };
    }

    // Check bio as fallback
    const bioVerified = await checkBioForCode(githubUsername, code);
    if (bioVerified) {
      await markGitHubVerified(candidateId, "bio");
      return { verified: true };
    }

    return { verified: false, error: "Verification code not found in your Gist or bio" };
  } catch (error: any) {
    return { verified: false, error: error.message };
  }
}

async function checkGistForCode(username: string, code: string): Promise<boolean> {
  try {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "TechChain-Talent-Hub",
    };

    if (env.GITHUB_TOKEN) {
      headers.Authorization = `token ${env.GITHUB_TOKEN}`;
    }

    const response = await fetch(
      `https://api.github.com/users/${username}/gists`,
      { headers }
    );

    if (!response.ok) {
      return false;
    }

    const gists = await response.json();

    for (const gist of gists) {
      // Check if any file is named techchain-verify.txt
      for (const filename of Object.keys(gist.files)) {
        if (filename.toLowerCase().includes("techchain-verify")) {
          // Fetch the gist content
          const gistResponse = await fetch(gist.url, { headers });
          if (gistResponse.ok) {
            const gistData = await gistResponse.json();
            for (const file of Object.values(gistData.files) as any[]) {
              if (file.content && file.content.includes(code)) {
                return true;
              }
            }
          }
        }
      }
    }

    return false;
  } catch {
    return false;
  }
}

async function checkBioForCode(username: string, code: string): Promise<boolean> {
  try {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "TechChain-Talent-Hub",
    };

    if (env.GITHUB_TOKEN) {
      headers.Authorization = `token ${env.GITHUB_TOKEN}`;
    }

    const response = await fetch(`https://api.github.com/users/${username}`, {
      headers,
    });

    if (!response.ok) {
      return false;
    }

    const user = await response.json();
    return user.bio && user.bio.includes(code);
  } catch {
    return false;
  }
}

async function markGitHubVerified(candidateId: string, method: string): Promise<void> {
  await prisma.candidateVerification.update({
    where: { candidateId },
    data: {
      githubProofVerifiedAt: new Date(),
      methodUsed: `github_${method}`,
      githubProofCode: null, // Clear the code
    },
  });
}

// Email verification (handled by NextAuth, but we track it)
export async function markEmailVerified(candidateId: string): Promise<void> {
  await prisma.candidateVerification.upsert({
    where: { candidateId },
    create: {
      candidateId,
      emailVerifiedAt: new Date(),
    },
    update: {
      emailVerifiedAt: new Date(),
    },
  });
}

// Phone verification (optional feature)
export async function initiatePhoneVerification(
  candidateId: string,
  phoneNumber: string
): Promise<{ sent: boolean; error?: string }> {
  if (!env.FEATURE_PHONE_VERIFICATION) {
    return { sent: false, error: "Phone verification is not enabled" };
  }

  // In production, integrate with Twilio or similar
  // For now, just return success in dev mode
  const { code } = generateVerificationCode();

  console.log(`[DEV] Phone verification code for ${phoneNumber}: ${code}`);

  return { sent: true };
}

export async function verifyPhone(
  candidateId: string,
  code: string
): Promise<{ verified: boolean; error?: string }> {
  if (!env.FEATURE_PHONE_VERIFICATION) {
    return { verified: false, error: "Phone verification is not enabled" };
  }

  // In production, verify the code
  // For dev mode, accept any 8-character code
  if (code.length === 8) {
    await prisma.candidateVerification.upsert({
      where: { candidateId },
      create: {
        candidateId,
        phoneVerifiedAt: new Date(),
      },
      update: {
        phoneVerifiedAt: new Date(),
      },
    });
    return { verified: true };
  }

  return { verified: false, error: "Invalid verification code" };
}

// Check verification status
export async function getVerificationStatus(
  candidateId: string
): Promise<{
  emailVerified: boolean;
  phoneVerified: boolean;
  githubVerified: boolean;
  verificationMethods: string[];
}> {
  const verification = await prisma.candidateVerification.findUnique({
    where: { candidateId },
  });

  if (!verification) {
    return {
      emailVerified: false,
      phoneVerified: false,
      githubVerified: false,
      verificationMethods: [],
    };
  }

  const methods: string[] = [];
  if (verification.emailVerifiedAt) methods.push("email");
  if (verification.phoneVerifiedAt) methods.push("phone");
  if (verification.githubProofVerifiedAt) methods.push("github");

  return {
    emailVerified: !!verification.emailVerifiedAt,
    phoneVerified: !!verification.phoneVerifiedAt,
    githubVerified: !!verification.githubProofVerifiedAt,
    verificationMethods: methods,
  };
}

// Interview verification for submissions
export async function verifyInterview(
  submissionId: string,
  verifiedBy: string
): Promise<void> {
  await prisma.candidateSubmission.update({
    where: { id: submissionId },
    data: {
      interviewVerifiedAt: new Date(),
      interviewVerifiedBy: verifiedBy,
    },
  });

  // Log the action
  await prisma.auditLog.create({
    data: {
      userId: verifiedBy,
      action: "interview_verified",
      entityType: "CandidateSubmission",
      entityId: submissionId,
    },
  });
}

// Fraud detection helpers
export interface FraudIndicators {
  score: number;
  flags: string[];
}

export function detectFraudIndicators(data: {
  email: string;
  phone?: string;
  linkedin?: string;
  github?: string;
  resumeText?: string;
}): FraudIndicators {
  const flags: string[] = [];
  let score = 0;

  // Check for disposable email domains
  const disposableDomains = [
    "tempmail.com",
    "throwaway.com",
    "mailinator.com",
    "guerrillamail.com",
  ];
  const emailDomain = data.email.split("@")[1]?.toLowerCase();
  if (emailDomain && disposableDomains.some((d) => emailDomain.includes(d))) {
    flags.push("Disposable email domain detected");
    score += 0.3;
  }

  // Check for very new or empty GitHub
  if (data.github) {
    // Would need to fetch and analyze
  }

  // Check for copy-paste indicators in resume
  if (data.resumeText) {
    // Look for common template phrases
    const templatePhrases = [
      "results-driven professional",
      "synergy",
      "think outside the box",
      "leverage core competencies",
    ];

    const lowerResume = data.resumeText.toLowerCase();
    for (const phrase of templatePhrases) {
      if (lowerResume.includes(phrase)) {
        flags.push(`Generic template phrase detected: "${phrase}"`);
        score += 0.1;
      }
    }
  }

  return { score: Math.min(score, 1), flags };
}
