import { z } from "zod";
import { getAIProvider } from "./ai";
import {
  TargetRoleBrief,
  CandidateSnippet,
  EvaluatedCandidate,
  EvaluatedCandidateSchema,
  OutreachDrafts,
  OutreachDraftsSchema,
  EvaluationResult,
} from "../schemas/evaluation";

// ─── Constants ───────────────────────────────────────────────────────────────

const SHORTLIST_MAX = 10;
const SHORTLIST_MIN_SCORE = 50;
const MAYBE_MIN_SCORE = 30;
const TOP_OUTREACH_COUNT = 5;

// ─── AI-Powered Single Candidate Evaluation ──────────────────────────────────

const SingleCandidateEvaluationSchema = z.object({
  totalScore: z.number().min(0).max(100),
  confidence: z.enum(["High", "Med", "Low"]),
  coreMustHavesFit: z.object({ score: z.number().min(0).max(40), justification: z.string() }),
  relevantScopeSeniority: z.object({ score: z.number().min(0).max(15), justification: z.string() }),
  domainIndustryRelevance: z.object({ score: z.number().min(0).max(10), justification: z.string() }),
  evidenceImpactMetrics: z.object({ score: z.number().min(0).max(10), justification: z.string() }),
  stabilityTrajectory: z.object({ score: z.number().min(0).max(10), justification: z.string() }),
  locationWorkModelAlignment: z.object({ score: z.number().min(0).max(5), justification: z.string() }),
  bonusSignals: z.object({ score: z.number().min(0).max(10), justification: z.string() }),
  hookLines: z.array(z.string()),
  concerns: z.array(z.string()),
  suggestedAngle: z.string(),
  extractedFacts: z.object({
    currentRole: z.string().optional(),
    yearsExperience: z.string().optional(),
    relevantSkills: z.array(z.string()).optional(),
    notableAchievements: z.array(z.string()).optional(),
    location: z.string().optional(),
  }),
  dealbreakersFound: z.array(z.string()),
});

type SingleCandidateEvaluation = z.infer<typeof SingleCandidateEvaluationSchema>;

const OutreachDraftAISchema = z.object({
  shortDraft1: z.string(),
  mediumDraft1: z.string(),
  shortDraft2: z.string(),
  mediumDraft2: z.string(),
});

// ─── Build Prompt Helpers ────────────────────────────────────────────────────

function buildRoleBriefText(role: TargetRoleBrief): string {
  return [
    `Title: ${role.title}`,
    `Seniority: ${role.seniority}`,
    `Must-have skills: ${role.mustHaveSkills.join(", ")}`,
    role.niceToHaveSkills?.length ? `Nice-to-have skills: ${role.niceToHaveSkills.join(", ")}` : null,
    role.domain ? `Domain/Industry: ${role.domain}` : null,
    `Location: ${role.location}`,
    role.timezone ? `Timezone: ${role.timezone}` : null,
    `Work model: ${role.workModel}`,
    `Experience range: ${role.yearsOfExperienceMin}–${role.yearsOfExperienceMax} years`,
    role.dealbreakers?.length ? `Dealbreakers: ${role.dealbreakers.join(", ")}` : null,
    role.compensationBand ? `Compensation band: ${role.compensationBand}` : null,
    `What "great" looks like:\n${role.whatGreatLooksLike.map((b) => `  - ${b}`).join("\n")}`,
    `Outreach value prop:\n${role.outreachValueProp.map((b) => `  - ${b}`).join("\n")}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function buildCandidateText(candidate: CandidateSnippet): string {
  const parts: string[] = [];
  if (candidate.name && candidate.name !== "Unknown") parts.push(`Name: ${candidate.name}`);
  if (candidate.headline) parts.push(`Headline: ${candidate.headline}`);
  if (candidate.about) parts.push(`About:\n${candidate.about}`);
  if (candidate.experience) parts.push(`Experience:\n${candidate.experience}`);
  if (candidate.skills) parts.push(`Skills: ${candidate.skills}`);
  if (candidate.location && candidate.location !== "Unknown") parts.push(`Location: ${candidate.location}`);
  if (candidate.rawText) parts.push(`Additional Info:\n${candidate.rawText}`);
  return parts.join("\n\n");
}

// ─── Evaluate a Single Candidate ─────────────────────────────────────────────

async function evaluateSingleCandidate(
  role: TargetRoleBrief,
  candidate: CandidateSnippet
): Promise<EvaluatedCandidate> {
  const provider = getAIProvider();

  const roleBriefText = buildRoleBriefText(role);
  const candidateText = buildCandidateText(candidate);

  const prompt = `Evaluate this candidate for the target role. Use ONLY the provided candidate data—do not invent or assume details. If information is missing, mark the relevant field as "Unknown" and lower confidence accordingly.

TARGET ROLE:
${roleBriefText}

CANDIDATE (ID: ${candidate.id}):
${candidateText || "No profile data provided."}

SCORING RUBRIC (score each category):
1. Core must-haves fit (0–40): How many of the must-have skills are evidenced?
2. Relevant scope/seniority (0–15): Does experience level match?
3. Domain/industry relevance (0–10): Industry alignment?
4. Evidence/impact/metrics (0–10): Are achievements quantified?
5. Stability & trajectory (0–10): Career progression signals?
6. Location/work-model alignment (0–5): Geo/remote fit?
7. Bonus signals (0–10): Notable products, leadership, rare skills?

Also evaluate:
- Confidence: High (>80% of key fields present), Med (50-80%), Low (<50%)
- hookLines: 1–3 reasons why this person is interesting for the role
- concerns: 1–3 unknowns or risks to validate
- suggestedAngle: The best approach angle for outreach
- extractedFacts: Pull only facts explicitly stated in the profile
- dealbreakersFound: Check against these dealbreakers: ${role.dealbreakers?.join(", ") || "none specified"}

totalScore should be the sum of all category scores.

Return JSON matching the schema.`;

  const systemPrompt = `You are a senior technical recruiter evaluating candidates for sourcing outreach. Be rigorous and objective. Use only provided data. Mark anything uncertain as "Unknown". Never fabricate profile details.`;

  const result = await provider.generateJSON(prompt, systemPrompt, SingleCandidateEvaluationSchema);

  return EvaluatedCandidateSchema.parse({
    id: candidate.id,
    name: candidate.name || "Unknown",
    totalScore: result.totalScore,
    confidence: result.confidence,
    breakdown: {
      coreMustHavesFit: { score: result.coreMustHavesFit.score, maxScore: 40, justification: result.coreMustHavesFit.justification },
      relevantScopeSeniority: { score: result.relevantScopeSeniority.score, maxScore: 15, justification: result.relevantScopeSeniority.justification },
      domainIndustryRelevance: { score: result.domainIndustryRelevance.score, maxScore: 10, justification: result.domainIndustryRelevance.justification },
      evidenceImpactMetrics: { score: result.evidenceImpactMetrics.score, maxScore: 10, justification: result.evidenceImpactMetrics.justification },
      stabilityTrajectory: { score: result.stabilityTrajectory.score, maxScore: 10, justification: result.stabilityTrajectory.justification },
      locationWorkModelAlignment: { score: result.locationWorkModelAlignment.score, maxScore: 5, justification: result.locationWorkModelAlignment.justification },
      bonusSignals: { score: result.bonusSignals.score, maxScore: 10, justification: result.bonusSignals.justification },
    },
    hookLines: result.hookLines.slice(0, 3),
    concerns: result.concerns.slice(0, 3),
    suggestedAngle: result.suggestedAngle,
    extractedFacts: result.extractedFacts,
    dealbreakersFound: result.dealbreakersFound,
  });
}

// ─── Generate Outreach Drafts ────────────────────────────────────────────────

async function generateOutreachDrafts(
  role: TargetRoleBrief,
  candidate: CandidateSnippet,
  evaluated: EvaluatedCandidate
): Promise<OutreachDrafts> {
  const provider = getAIProvider();

  const prompt = `Write personalized LinkedIn-style outreach messages for this candidate.

ROLE: ${role.title} (${role.seniority})
VALUE PROP: ${role.outreachValueProp.join("; ")}

CANDIDATE: ${candidate.name || "Unknown"}
Headline: ${candidate.headline || "Unknown"}
Hook lines: ${evaluated.hookLines.join("; ")}
Suggested angle: ${evaluated.suggestedAngle}

IMPORTANT RULES:
- Reference ONLY details from the candidate's profile text. Do not invent details.
- Include a gentle call-to-action (e.g., "Would you be open to a quick chat?")
- Be natural, not spammy. No exclamation marks overload.
- Short drafts: max 300 characters each
- Medium drafts: 60–120 words each
- Write 2 variants of each (short and medium)

Return JSON with: shortDraft1, mediumDraft1, shortDraft2, mediumDraft2`;

  const systemPrompt = `You are an expert recruiter writing personalized outreach messages. Be authentic, specific, and concise. Never invent candidate details. Always include a soft call-to-action.`;

  const result = await provider.generateJSON(prompt, systemPrompt, OutreachDraftAISchema);

  return OutreachDraftsSchema.parse({
    candidateId: candidate.id,
    candidateName: candidate.name || "Unknown",
    shortDraft1: result.shortDraft1.slice(0, 300),
    mediumDraft1: result.mediumDraft1,
    shortDraft2: result.shortDraft2.slice(0, 300),
    mediumDraft2: result.mediumDraft2,
  });
}

// ─── Role Summary Generator ──────────────────────────────────────────────────

function generateRoleSummary(role: TargetRoleBrief): string {
  const lines: string[] = [
    `**${role.title}** (${role.seniority})`,
    "",
    "**Must-haves:**",
    ...role.mustHaveSkills.map((s) => `- ${s}`),
    "",
    '**What "great" looks like:**',
    ...role.whatGreatLooksLike.map((b) => `- ${b}`),
  ];

  if (role.dealbreakers?.length) {
    lines.push("", "**Dealbreakers:**", ...role.dealbreakers.map((d) => `- ${d}`));
  }

  lines.push(
    "",
    `**Location:** ${role.location} | **Work model:** ${role.workModel} | **Experience:** ${role.yearsOfExperienceMin}–${role.yearsOfExperienceMax} years`
  );

  return lines.join("\n");
}

// ─── Scoring Rubric Description ──────────────────────────────────────────────

function generateScoringRubric() {
  return {
    coreMustHavesFit: "0–40 pts: How many must-have skills are evidenced in the profile? Full marks for all skills clearly demonstrated.",
    relevantScopeSeniority: "0–15 pts: Does the candidate's experience level, team size managed, and scope of work match the target seniority?",
    domainIndustryRelevance: "0–10 pts: Has the candidate worked in the target domain/industry? Direct experience scores highest.",
    evidenceImpactMetrics: "0–10 pts: Are achievements quantified with metrics, revenue, scale, or other concrete evidence?",
    stabilityTrajectory: "0–10 pts: Does the career trajectory show growth? Reasonable tenure at companies? Consistent progression?",
    locationWorkModelAlignment: "0–5 pts: Does the candidate's stated location and work preference match the role requirements?",
    bonusSignals: "0–10 pts: Notable company pedigree, rare skill combos, thought leadership, open-source contributions, patents, etc.",
  };
}

// ─── Main Evaluation Pipeline ────────────────────────────────────────────────

export async function evaluateCandidates(
  roleBrief: TargetRoleBrief,
  candidates: CandidateSnippet[]
): Promise<EvaluationResult> {
  // 1. Evaluate each candidate
  const evaluations: EvaluatedCandidate[] = [];
  for (const candidate of candidates) {
    const evaluated = await evaluateSingleCandidate(roleBrief, candidate);
    evaluations.push(evaluated);
  }

  // 2. Sort by score descending
  evaluations.sort((a, b) => b.totalScore - a.totalScore);

  // 3. Separate into buckets
  const doNotContact: { id: string; name: string; reason: string }[] = [];
  const shortlist: EvaluatedCandidate[] = [];
  const maybes: EvaluatedCandidate[] = [];

  for (const ev of evaluations) {
    if (ev.dealbreakersFound && ev.dealbreakersFound.length > 0) {
      doNotContact.push({
        id: ev.id,
        name: ev.name,
        reason: `Dealbreaker(s): ${ev.dealbreakersFound.join("; ")}`,
      });
    } else if (ev.totalScore >= SHORTLIST_MIN_SCORE && shortlist.length < SHORTLIST_MAX) {
      shortlist.push(ev);
    } else if (ev.totalScore >= MAYBE_MIN_SCORE) {
      maybes.push(ev);
    } else {
      maybes.push(ev);
    }
  }

  // 4. Generate outreach drafts for top 5 shortlisted candidates
  const topCandidates = shortlist.slice(0, TOP_OUTREACH_COUNT);
  const outreachDrafts: OutreachDrafts[] = [];

  for (const topCandidate of topCandidates) {
    const originalSnippet = candidates.find((c) => c.id === topCandidate.id);
    if (originalSnippet) {
      const drafts = await generateOutreachDrafts(roleBrief, originalSnippet, topCandidate);
      outreachDrafts.push(drafts);
    }
  }

  // 5. Build result
  return {
    roleSummary: generateRoleSummary(roleBrief),
    scoringRubric: generateScoringRubric(),
    rankedShortlist: shortlist,
    maybes,
    doNotContact,
    outreachDrafts,
  };
}

// ─── Validate Role Brief Completeness ────────────────────────────────────────

export interface RoleBriefValidation {
  isComplete: boolean;
  missingFields: string[];
  clarifyingQuestions: string[];
}

export function validateRoleBriefCompleteness(brief: Partial<TargetRoleBrief>): RoleBriefValidation {
  const missingFields: string[] = [];
  const clarifyingQuestions: string[] = [];

  if (!brief.mustHaveSkills?.length) {
    missingFields.push("mustHaveSkills");
    clarifyingQuestions.push("What are the must-have skills for this role? (max 8)");
  }

  if (!brief.location) {
    missingFields.push("location");
    clarifyingQuestions.push("What location or timezone is required?");
  }

  if (!brief.workModel) {
    missingFields.push("workModel");
    clarifyingQuestions.push("What is the work model: remote, hybrid, on-site, or flexible?");
  }

  if (!brief.seniority) {
    missingFields.push("seniority");
    clarifyingQuestions.push("What seniority level is this role?");
  }

  return {
    isComplete: missingFields.length === 0,
    missingFields,
    clarifyingQuestions: clarifyingQuestions.slice(0, 3),
  };
}
