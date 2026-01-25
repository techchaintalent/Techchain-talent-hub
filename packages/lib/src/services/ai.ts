import OpenAI from "openai";
import { z } from "zod";
import { env, isDevMode } from "../env";
import {
  CandidateSummarySchema,
  CryptoScoreSchema,
  EmployabilityPlanSchema,
  RoleFitAssessmentSchema,
  ScreeningQuestionsSchema,
} from "../schemas";

// AI Provider Interface
export interface AIProvider {
  generateJSON<T>(
    prompt: string,
    systemPrompt: string,
    schema: z.ZodType<T>
  ): Promise<T>;
  generateEmbedding(text: string): Promise<number[]>;
}

// OpenAI Provider
class OpenAIProvider implements AIProvider {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: env.OPENAI_API_KEY,
    });
  }

  async generateJSON<T>(
    prompt: string,
    systemPrompt: string,
    schema: z.ZodType<T>
  ): Promise<T> {
    const response = await this.client.chat.completions.create({
      model: env.OPENAI_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from AI");
    }

    const parsed = JSON.parse(content);
    return schema.parse(parsed);
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const response = await this.client.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
    });

    return response.data[0].embedding;
  }
}

// Mock AI Provider for dev mode
class MockAIProvider implements AIProvider {
  async generateJSON<T>(
    prompt: string,
    systemPrompt: string,
    schema: z.ZodType<T>
  ): Promise<T> {
    // Return mock data based on the schema type
    const schemaName = (schema as any)._def?.description || "unknown";

    console.log(`[MockAI] Generating response for: ${schemaName}`);

    // Generate mock responses based on schema
    let mockData: any;

    if (prompt.includes("crypto native score") || prompt.includes("cryptoNativeScore")) {
      mockData = {
        cryptoNativeScore: 72,
        rationale: "Mock analysis: Candidate shows moderate crypto-native indicators based on resume content. Has experience with blockchain projects but could demonstrate deeper ecosystem involvement.",
        confidence: 0.8,
        flags: null,
      };
    } else if (prompt.includes("employability") || prompt.includes("career plan")) {
      mockData = {
        headlineSummary: "A promising candidate with solid technical foundation seeking to deepen crypto expertise.",
        topStrengths: [
          "Strong programming fundamentals",
          "Prior blockchain project experience",
          "Adaptable and eager to learn",
        ],
        biggestGaps: [
          "Limited production DeFi experience",
          "Could strengthen security knowledge",
          "More ecosystem involvement needed",
        ],
        thirtyDayPlan: {
          projectsToBuild: ["Build a simple DEX interface", "Deploy a token on testnet"],
          learningResources: ["Solidity by Example", "Patrick Collins' course"],
          portfolioImprovements: ["Add detailed READMEs", "Create project demos"],
          networkingActions: ["Join Discord communities", "Attend local meetups"],
        },
        sixtyDayPlan: {
          projectsToBuild: ["Implement a lending protocol", "Build a DAO voting system"],
          learningResources: ["Study DeFi protocol internals", "Security audit patterns"],
          portfolioImprovements: ["Write technical blog posts"],
          networkingActions: ["Apply to hackathon", "Contribute to open source"],
        },
        ninetyDayPlan: {
          projectsToBuild: ["Complete security challenges", "Build novel protocol"],
          learningResources: ["Advanced MEV concepts", "Cross-chain patterns"],
          portfolioImprovements: ["Case studies of projects"],
          networkingActions: ["Reach out to hiring managers", "Build Twitter presence"],
        },
        suggestedRolesToPursue: ["Smart Contract Developer", "Full-stack Web3 Engineer"],
        suggestedKeywordsForCV: ["Solidity", "DeFi", "EVM", "Smart Contracts"],
        suggestedInterviewPrep: ["Practice whiteboarding AMM design", "Review common vulnerabilities"],
        confidence: 0.75,
        caveats: "This is a mock assessment for development purposes.",
      };
    } else if (prompt.includes("role fit") || prompt.includes("fitScore")) {
      mockData = {
        fitScore: 70,
        whyFit: [
          "Relevant technical skills",
          "Interest in the domain",
          "Appropriate experience level",
        ],
        missingSkills: [
          "Production experience in this specific area",
          "Deeper protocol knowledge",
        ],
        recommendedNextSteps: [
          "Build relevant side projects",
          "Study the specific technology stack",
        ],
      };
    } else if (prompt.includes("summary") || prompt.includes("candidate assessment")) {
      mockData = {
        overallFit: "Good",
        fitScore: 75,
        summary: "Mock summary: This candidate shows promise with relevant background and skills. Recommended for further evaluation.",
        strengths: [
          "Strong technical foundation",
          "Relevant prior experience",
          "Good communication skills",
        ],
        concerns: [
          "May need ramp-up time on specific tech",
          "Limited crypto-native experience",
        ],
        recommendedNextSteps: [
          "Technical screening",
          "Team culture fit interview",
        ],
      };
    } else if (prompt.includes("screening questions")) {
      mockData = {
        questions: [
          {
            id: "q1",
            question: "Describe your experience with smart contract development.",
            purpose: "Assess hands-on technical experience",
            required: true,
          },
          {
            id: "q2",
            question: "What DeFi protocols are you most familiar with?",
            purpose: "Evaluate ecosystem knowledge",
            required: true,
          },
          {
            id: "q3",
            question: "How do you approach security in your development work?",
            purpose: "Assess security mindset",
            required: false,
          },
        ],
      };
    } else {
      // Default mock response
      mockData = { message: "Mock response generated" };
    }

    // Validate against schema
    return schema.parse(mockData);
  }

  async generateEmbedding(text: string): Promise<number[]> {
    // Generate a deterministic mock embedding based on text hash
    const hash = simpleHash(text);
    const embedding = new Array(1536).fill(0).map((_, i) => {
      return Math.sin(hash + i) * 0.5;
    });
    return embedding;
  }
}

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return hash;
}

// Factory function
let aiProvider: AIProvider | null = null;

export function getAIProvider(): AIProvider {
  if (!aiProvider) {
    if (isDevMode() || env.AI_PROVIDER === "mock") {
      console.log("[AI] Using MockAIProvider");
      aiProvider = new MockAIProvider();
    } else if (env.AI_PROVIDER === "openai") {
      if (!env.OPENAI_API_KEY) {
        throw new Error("OPENAI_API_KEY is required when AI_PROVIDER is openai");
      }
      aiProvider = new OpenAIProvider();
    } else {
      throw new Error(`Unsupported AI provider: ${env.AI_PROVIDER}`);
    }
  }
  return aiProvider;
}

// High-level AI functions

export async function generateCandidateSummary(
  resumeText: string,
  roleTitle: string,
  roleDescription: string,
  screeningAnswers?: string
): Promise<z.infer<typeof CandidateSummarySchema>> {
  const provider = getAIProvider();

  const prompt = `Analyze this candidate for the role of "${roleTitle}".

Role Description:
${roleDescription}

Candidate Resume:
${resumeText}

${screeningAnswers ? `Screening Answers:\n${screeningAnswers}` : ""}

Provide a comprehensive candidate assessment as JSON.`;

  const systemPrompt = `You are a senior technical recruiter specializing in crypto and Web3 hiring.
Analyze candidates objectively and provide actionable insights.
Return a JSON object with: overallFit (string), fitScore (0-100), summary (string), strengths (array), concerns (array), recommendedNextSteps (array).`;

  return provider.generateJSON(prompt, systemPrompt, CandidateSummarySchema);
}

export async function generateCryptoScore(
  resumeText: string,
  linkedinPaste?: string,
  tweetSamples?: string
): Promise<z.infer<typeof CryptoScoreSchema>> {
  const provider = getAIProvider();

  const prompt = `Analyze this candidate's crypto-native profile and generate a crypto native score.

Resume:
${resumeText}

${linkedinPaste ? `LinkedIn About/Experience:\n${linkedinPaste}` : ""}
${tweetSamples ? `Tweet Samples:\n${tweetSamples}` : ""}

Evaluate:
1. Direct crypto/blockchain work experience
2. Understanding of crypto ecosystem (DeFi, NFTs, L2s, etc.)
3. Participation in crypto communities, DAOs, hackathons
4. Technical skills relevant to crypto (Solidity, Rust for blockchain, etc.)
5. Thought leadership and content creation in crypto

Return JSON with: cryptoNativeScore (0-100), rationale (detailed explanation), confidence (0-1), flags (any concerns or null).`;

  const systemPrompt = `You are an expert at evaluating crypto-native talent.
Score candidates based on their demonstrated involvement and expertise in the crypto ecosystem.
Be objective and explain your reasoning clearly.`;

  return provider.generateJSON(prompt, systemPrompt, CryptoScoreSchema);
}

export async function generateEmployabilityPlan(
  resumeText: string,
  desiredRoles: string[],
  cryptoInterests: string[],
  cryptoScore?: { score: number; rationale: string },
  techScores?: Record<string, number>
): Promise<z.infer<typeof EmployabilityPlanSchema>> {
  const provider = getAIProvider();

  const prompt = `Generate a personalized, crypto-specific employability plan for this candidate.

Resume:
${resumeText}

Target Roles: ${desiredRoles.join(", ")}
Crypto Interests: ${cryptoInterests.join(", ")}

${cryptoScore ? `Current Crypto Native Score: ${cryptoScore.score}/100\nRationale: ${cryptoScore.rationale}` : ""}
${techScores ? `Technical Scores: ${JSON.stringify(techScores)}` : ""}

Create a detailed, actionable plan with specific crypto-focused recommendations.
Include concrete projects to build, resources to study, and networking actions.
Make it specific to their target roles and interests.`;

  const systemPrompt = `You are a senior crypto career coach. Create highly specific, actionable career plans.
Focus on practical steps that will demonstrably improve the candidate's crypto employability.
Be specific about technologies, projects, and actions - avoid generic advice.
Return JSON matching the EmployabilityPlanSchema.`;

  return provider.generateJSON(prompt, systemPrompt, EmployabilityPlanSchema);
}

export async function generateRoleFitAssessment(
  resumeText: string,
  targetRole: string,
  archetypeDescription?: string
): Promise<z.infer<typeof RoleFitAssessmentSchema>> {
  const provider = getAIProvider();

  const prompt = `Assess how well this candidate fits the role of "${targetRole}".

Resume:
${resumeText}

${archetypeDescription ? `Role Archetype:\n${archetypeDescription}` : ""}

Provide a detailed role fit assessment.`;

  const systemPrompt = `You are a senior technical recruiter specializing in crypto hiring.
Evaluate role fit objectively based on skills, experience, and potential.
Return JSON with: fitScore (0-100), whyFit (array of strings), missingSkills (array), recommendedNextSteps (array).`;

  return provider.generateJSON(prompt, systemPrompt, RoleFitAssessmentSchema);
}

export async function generateScreeningQuestions(
  roleTitle: string,
  roleDescription: string,
  requirements: string
): Promise<z.infer<typeof ScreeningQuestionsSchema>> {
  const provider = getAIProvider();

  const prompt = `Generate screening questions for the role: ${roleTitle}

Description: ${roleDescription}

Requirements: ${requirements}

Create 3-5 thoughtful screening questions that will help assess candidate fit.`;

  const systemPrompt = `You are a senior hiring manager in crypto/Web3.
Create screening questions that reveal genuine experience and problem-solving ability.
Avoid questions with obvious "right" answers.
Return JSON with: questions (array of {id, question, purpose, required}).`;

  return provider.generateJSON(prompt, systemPrompt, ScreeningQuestionsSchema);
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const provider = getAIProvider();
  return provider.generateEmbedding(text);
}
