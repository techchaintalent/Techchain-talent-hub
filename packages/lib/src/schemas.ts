import { z } from "zod";

// Candidate Summary Schema (for recruiter submissions)
export const CandidateSummarySchema = z.object({
  overallFit: z.string(),
  fitScore: z.number().min(0).max(100),
  summary: z.string(),
  strengths: z.array(z.string()),
  concerns: z.array(z.string()),
  recommendedNextSteps: z.array(z.string()),
});

export type CandidateSummary = z.infer<typeof CandidateSummarySchema>;

// Crypto Score Schema
export const CryptoScoreSchema = z.object({
  cryptoNativeScore: z.number().min(0).max(100),
  rationale: z.string(),
  confidence: z.number().min(0).max(1),
  flags: z.any().nullable(),
});

export type CryptoScore = z.infer<typeof CryptoScoreSchema>;

// Employability Plan Schema
export const ActionPlanSchema = z.object({
  projectsToBuild: z.array(z.string()),
  learningResources: z.array(z.string()),
  portfolioImprovements: z.array(z.string()),
  networkingActions: z.array(z.string()),
});

export const EmployabilityPlanSchema = z.object({
  headlineSummary: z.string(),
  topStrengths: z.array(z.string()),
  biggestGaps: z.array(z.string()),
  thirtyDayPlan: ActionPlanSchema,
  sixtyDayPlan: ActionPlanSchema,
  ninetyDayPlan: ActionPlanSchema,
  suggestedRolesToPursue: z.array(z.string()),
  suggestedKeywordsForCV: z.array(z.string()),
  suggestedInterviewPrep: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  caveats: z.string(),
});

export type EmployabilityPlan = z.infer<typeof EmployabilityPlanSchema>;

// Role Fit Assessment Schema
export const RoleFitAssessmentSchema = z.object({
  fitScore: z.number().min(0).max(100),
  whyFit: z.array(z.string()),
  missingSkills: z.array(z.string()),
  recommendedNextSteps: z.array(z.string()),
});

export type RoleFitAssessment = z.infer<typeof RoleFitAssessmentSchema>;

// Screening Questions Schema
export const ScreeningQuestionSchema = z.object({
  id: z.string(),
  question: z.string(),
  purpose: z.string(),
  required: z.boolean(),
});

export const ScreeningQuestionsSchema = z.object({
  questions: z.array(ScreeningQuestionSchema),
});

export type ScreeningQuestions = z.infer<typeof ScreeningQuestionsSchema>;

// Recruiter Profile Schema
export const RecruiterProfileSchema = z.object({
  fullName: z.string().min(2, "Name must be at least 2 characters"),
  phone: z.string().optional(),
  linkedinUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  location: z.string().min(2, "Location is required"),
  timezone: z.string().min(1, "Timezone is required"),
  experienceYears: z.number().min(0).max(50),
  specializations: z.array(z.string()).min(1, "Select at least one specialization"),
  cryptoExperience: z.boolean(),
  cryptoSpecializations: z.array(z.string()).optional(),
  bio: z.string().max(1000, "Bio must be under 1000 characters").optional(),
});

export type RecruiterProfileInput = z.infer<typeof RecruiterProfileSchema>;

// Candidate Profile Schema
export const CandidateProfileSchema = z.object({
  fullName: z.string().min(2, "Name must be at least 2 characters"),
  location: z.string().min(2, "Location is required"),
  timezone: z.string().min(1, "Timezone is required"),
  phone: z.string().optional(),
  desiredRoleTitles: z.array(z.string()).min(1, "Select at least one desired role"),
  experienceLevel: z.enum(["Entry", "Junior", "Mid", "Senior", "Lead", "Executive"]),
  availability: z.enum(["IMMEDIATE", "TWO_WEEKS", "THIRTY_DAYS", "SIXTY_DAYS", "NOT_LOOKING"]),
  remotePreference: z.enum(["remote", "hybrid", "onsite", "flexible"]),
  salaryExpectation: z.string().optional(),
  cryptoInterests: z.array(z.string()).min(1, "Select at least one interest"),
  linkedinUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  githubUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  twitterUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  websiteUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  linkedinAboutPaste: z.string().max(5000).optional(),
  tweetSamplesPaste: z.string().max(2000).optional(),
});

export type CandidateProfileInput = z.infer<typeof CandidateProfileSchema>;

// Candidate Consent Schema
export const CandidateConsentSchema = z.object({
  consentToProcess: z.boolean().refine((val) => val === true, {
    message: "You must consent to data processing to continue",
  }),
  consentToAnalyzeFootprint: z.boolean().optional(),
  consentToAnalyzeGithub: z.boolean().optional(),
  consentToBeContacted: z.boolean().optional(),
});

export type CandidateConsentInput = z.infer<typeof CandidateConsentSchema>;

// Role Schema
export const RoleSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().min(50, "Description must be at least 50 characters"),
  requirements: z.string().min(20, "Requirements must be at least 20 characters"),
  responsibilities: z.string().optional(),
  location: z.string().min(2, "Location is required"),
  locationType: z.enum(["REMOTE", "HYBRID", "ONSITE"]),
  salaryMin: z.number().min(0).optional(),
  salaryMax: z.number().min(0).optional(),
  salaryCurrency: z.string().default("USD"),
  commissionType: z.enum(["PERCENTAGE", "FIXED"]),
  commissionValue: z.number().min(0),
  accessModel: z.enum(["OPEN", "REQUEST", "INVITE_ONLY"]),
  cryptoTags: z.array(z.string()).optional(),
  techStack: z.array(z.string()).optional(),
  experienceLevel: z.string().optional(),
});

export type RoleInput = z.infer<typeof RoleSchema>;

// Submission Schema
export const SubmissionSchema = z.object({
  candidateName: z.string().min(2, "Name is required"),
  candidateEmail: z.string().email("Valid email is required"),
  candidatePhone: z.string().optional(),
  candidateLinkedin: z.string().url().optional().or(z.literal("")),
  candidateGithub: z.string().url().optional().or(z.literal("")),
  coverNote: z.string().max(2000).optional(),
  screeningAnswers: z.record(z.string()).optional(),
  candidateConsent: z.boolean().refine((val) => val === true, {
    message: "Candidate consent is required",
  }),
  recruiterAttestation: z.boolean().refine((val) => val === true, {
    message: "Recruiter attestation is required",
  }),
});

export type SubmissionInput = z.infer<typeof SubmissionSchema>;

// API Response Schemas
export const ApiErrorSchema = z.object({
  error: z.string(),
  code: z.string().optional(),
  details: z.any().optional(),
});

export const ApiSuccessSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  message: z.string().optional(),
});

// Pagination Schema
export const PaginationSchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export type PaginationInput = z.infer<typeof PaginationSchema>;

// Filter Schemas
export const RoleFilterSchema = z.object({
  status: z.enum(["DRAFT", "LIVE", "PAUSED", "FILLED", "CANCELLED"]).optional(),
  accessModel: z.enum(["OPEN", "REQUEST", "INVITE_ONLY"]).optional(),
  locationType: z.enum(["REMOTE", "HYBRID", "ONSITE"]).optional(),
  cryptoTags: z.array(z.string()).optional(),
  techStack: z.array(z.string()).optional(),
  search: z.string().optional(),
});

export type RoleFilterInput = z.infer<typeof RoleFilterSchema>;

// Common option types
export const EXPERIENCE_LEVELS = [
  "Entry",
  "Junior",
  "Mid",
  "Senior",
  "Lead",
  "Executive",
] as const;

export const AVAILABILITY_OPTIONS = [
  { value: "IMMEDIATE", label: "Available immediately" },
  { value: "TWO_WEEKS", label: "2 weeks notice" },
  { value: "THIRTY_DAYS", label: "30 days notice" },
  { value: "SIXTY_DAYS", label: "60 days notice" },
  { value: "NOT_LOOKING", label: "Not actively looking" },
] as const;

export const REMOTE_PREFERENCES = [
  { value: "remote", label: "Remote only" },
  { value: "hybrid", label: "Hybrid" },
  { value: "onsite", label: "On-site" },
  { value: "flexible", label: "Flexible" },
] as const;

export const CRYPTO_INTERESTS = [
  "DeFi",
  "NFTs",
  "L1/L2 Infrastructure",
  "Wallets",
  "Security/Auditing",
  "DAOs",
  "Gaming/Metaverse",
  "Exchanges",
  "Cross-chain/Bridges",
  "ZK/Privacy",
  "Social/Identity",
  "Data/Analytics",
  "Developer Tools",
  "Stablecoins",
  "MEV",
] as const;

export const CRYPTO_ROLE_TITLES = [
  "Solidity Engineer",
  "Smart Contract Developer",
  "Rust Blockchain Engineer",
  "Full-stack Web3 Developer",
  "Frontend Web3 Developer",
  "Protocol Engineer",
  "Security Researcher",
  "DeFi Developer",
  "NFT Developer",
  "ZK Engineer",
  "DevRel / Developer Advocate",
  "Technical Writer",
  "Product Manager",
  "Business Development",
  "Community Manager",
  "Growth Lead",
  "Marketing Lead",
  "Operations",
  "Legal/Compliance",
  "Finance/Treasury",
] as const;

export const RECRUITER_SPECIALIZATIONS = [
  "Engineering",
  "Product",
  "Design",
  "Business Development",
  "Marketing",
  "Operations",
  "Executive",
  "Legal/Compliance",
] as const;
