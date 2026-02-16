import { z } from "zod";

// ─── Target Role Brief ───────────────────────────────────────────────────────

export const TargetRoleBriefSchema = z.object({
  title: z.string().min(1, "Title is required"),
  seniority: z.string().min(1, "Seniority level is required"),
  mustHaveSkills: z.array(z.string()).min(1).max(8, "Maximum 8 must-have skills"),
  niceToHaveSkills: z.array(z.string()).optional().default([]),
  domain: z.string().optional().default(""),
  location: z.string().min(1, "Location is required"),
  timezone: z.string().optional().default(""),
  workModel: z.enum(["remote", "hybrid", "on-site", "flexible"]),
  yearsOfExperienceMin: z.number().min(0),
  yearsOfExperienceMax: z.number().min(0),
  dealbreakers: z.array(z.string()).optional().default([]),
  compensationBand: z.string().optional().default(""),
  whatGreatLooksLike: z.array(z.string()).min(1).max(4),
  outreachValueProp: z.array(z.string()).min(1).max(4),
});

export type TargetRoleBrief = z.infer<typeof TargetRoleBriefSchema>;

// ─── Candidate Profile Snippet ───────────────────────────────────────────────

export const CandidateSnippetSchema = z.object({
  id: z.string().min(1, "Candidate ID is required"),
  name: z.string().optional().default("Unknown"),
  headline: z.string().optional().default(""),
  about: z.string().optional().default(""),
  experience: z.string().optional().default(""),
  skills: z.string().optional().default(""),
  location: z.string().optional().default("Unknown"),
  rawText: z.string().optional().default(""),
});

export type CandidateSnippet = z.infer<typeof CandidateSnippetSchema>;

// ─── Evaluation Input ────────────────────────────────────────────────────────

export const EvaluationInputSchema = z.object({
  roleBrief: TargetRoleBriefSchema,
  candidates: z.array(CandidateSnippetSchema).min(1, "At least one candidate is required"),
});

export type EvaluationInput = z.infer<typeof EvaluationInputSchema>;

// ─── Scoring Rubric (output) ─────────────────────────────────────────────────

export const CategoryScoreSchema = z.object({
  score: z.number().min(0),
  maxScore: z.number(),
  justification: z.string(),
});

export type CategoryScore = z.infer<typeof CategoryScoreSchema>;

export const CandidateScoreBreakdownSchema = z.object({
  coreMustHavesFit: CategoryScoreSchema,
  relevantScopeSeniority: CategoryScoreSchema,
  domainIndustryRelevance: CategoryScoreSchema,
  evidenceImpactMetrics: CategoryScoreSchema,
  stabilityTrajectory: CategoryScoreSchema,
  locationWorkModelAlignment: CategoryScoreSchema,
  bonusSignals: CategoryScoreSchema,
});

export type CandidateScoreBreakdown = z.infer<typeof CandidateScoreBreakdownSchema>;

// ─── Evaluated Candidate ─────────────────────────────────────────────────────

export const EvaluatedCandidateSchema = z.object({
  id: z.string(),
  name: z.string(),
  totalScore: z.number().min(0).max(100),
  confidence: z.enum(["High", "Med", "Low"]),
  breakdown: CandidateScoreBreakdownSchema,
  hookLines: z.array(z.string()).min(1).max(3),
  concerns: z.array(z.string()).min(1).max(3),
  suggestedAngle: z.string(),
  extractedFacts: z.object({
    currentRole: z.string().optional(),
    yearsExperience: z.string().optional(),
    relevantSkills: z.array(z.string()).optional(),
    notableAchievements: z.array(z.string()).optional(),
    location: z.string().optional(),
  }),
  dealbreakersFound: z.array(z.string()).optional().default([]),
});

export type EvaluatedCandidate = z.infer<typeof EvaluatedCandidateSchema>;

// ─── Outreach Drafts ─────────────────────────────────────────────────────────

export const OutreachDraftsSchema = z.object({
  candidateId: z.string(),
  candidateName: z.string(),
  shortDraft1: z.string().max(300),
  mediumDraft1: z.string(),
  shortDraft2: z.string().max(300),
  mediumDraft2: z.string(),
});

export type OutreachDrafts = z.infer<typeof OutreachDraftsSchema>;

// ─── Full Evaluation Result ──────────────────────────────────────────────────

export const EvaluationResultSchema = z.object({
  roleSummary: z.string(),
  scoringRubric: z.object({
    coreMustHavesFit: z.string(),
    relevantScopeSeniority: z.string(),
    domainIndustryRelevance: z.string(),
    evidenceImpactMetrics: z.string(),
    stabilityTrajectory: z.string(),
    locationWorkModelAlignment: z.string(),
    bonusSignals: z.string(),
  }),
  rankedShortlist: z.array(EvaluatedCandidateSchema),
  maybes: z.array(EvaluatedCandidateSchema),
  doNotContact: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      reason: z.string(),
    })
  ),
  outreachDrafts: z.array(OutreachDraftsSchema),
});

export type EvaluationResult = z.infer<typeof EvaluationResultSchema>;
