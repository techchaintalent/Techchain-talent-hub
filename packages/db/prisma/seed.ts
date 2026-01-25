import { PrismaClient, UserRole, RecruiterStatus, RoleStatus, RoleAccessModel, CommissionType, CandidateProfileStatus, AvailabilityType, AssessmentRunStatus, CommissionStatus } from "@prisma/client";
import { createHash } from "crypto";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting seed...");

  // Clean up existing data
  console.log("🧹 Cleaning existing data...");
  await prisma.hiddenTalentMatch.deleteMany();
  await prisma.devEmail.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.adminAction.deleteMany();
  await prisma.platformConfig.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.commission.deleteMany();
  await prisma.candidateScoring.deleteMany();
  await prisma.candidateSubmission.deleteMany();
  await prisma.roleAccess.deleteMany();
  await prisma.roleFitArchetype.deleteMany();
  await prisma.role.deleteMany();
  await prisma.companyMember.deleteMany();
  await prisma.company.deleteMany();
  await prisma.candidateTechScore.deleteMany();
  await prisma.candidateCryptoScore.deleteMany();
  await prisma.candidateRoleFitAssessment.deleteMany();
  await prisma.candidateEmployabilityPlan.deleteMany();
  await prisma.candidateAssessmentRun.deleteMany();
  await prisma.candidateVerification.deleteMany();
  await prisma.candidateProfile.deleteMany();
  await prisma.recruiterProfile.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.verificationToken.deleteMany();
  await prisma.user.deleteMany();

  // ===========================================
  // Platform Configuration
  // ===========================================
  console.log("⚙️ Creating platform configuration...");

  await prisma.platformConfig.createMany({
    data: [
      { key: "default_take_rate", value: "15", description: "Default platform take rate percentage" },
      { key: "payment_delay_days", value: "14", description: "Days after start date to collect payment" },
      { key: "min_commission_amount", value: "1000", description: "Minimum commission amount in USD" },
      { key: "feature_phone_verification", value: "false", description: "Enable phone verification" },
      { key: "feature_candidate_discovery", value: "true", description: "Enable candidate discovery" },
      { key: "feature_company_candidate_browse", value: "false", description: "Allow companies to browse candidates" },
    ],
  });

  // ===========================================
  // Platform Admin
  // ===========================================
  console.log("👤 Creating platform admin...");

  const admin = await prisma.user.create({
    data: {
      email: "admin@techchain.io",
      name: "Platform Admin",
      emailVerified: new Date(),
      role: UserRole.PLATFORM_ADMIN,
    },
  });

  // ===========================================
  // Companies
  // ===========================================
  console.log("🏢 Creating companies...");

  const defiProtocol = await prisma.company.create({
    data: {
      name: "DeFi Protocol Labs",
      website: "https://defiprotocol.example",
      description: "Leading DeFi protocol building the next generation of decentralized finance infrastructure.",
      industry: "DeFi",
      size: "51-200",
      location: "Remote",
      isActive: true,
      verifiedAt: new Date(),
      billingEmail: "billing@defiprotocol.example",
    },
  });

  const l2Chain = await prisma.company.create({
    data: {
      name: "L2 Chain Inc",
      website: "https://l2chain.example",
      description: "Building scalable Layer 2 solutions for Ethereum.",
      industry: "Infrastructure",
      size: "11-50",
      location: "San Francisco, CA",
      isActive: true,
      verifiedAt: new Date(),
      billingEmail: "billing@l2chain.example",
      takeRateOverride: 12, // Custom lower take rate
    },
  });

  // ===========================================
  // Company Admins
  // ===========================================
  console.log("👥 Creating company admins...");

  const defiAdmin = await prisma.user.create({
    data: {
      email: "hiring@defiprotocol.example",
      name: "Sarah Chen",
      emailVerified: new Date(),
      role: UserRole.COMPANY_ADMIN,
      companyMembership: {
        create: {
          companyId: defiProtocol.id,
          role: "ADMIN",
        },
      },
    },
  });

  const l2Admin = await prisma.user.create({
    data: {
      email: "hiring@l2chain.example",
      name: "Mike Johnson",
      emailVerified: new Date(),
      role: UserRole.COMPANY_ADMIN,
      companyMembership: {
        create: {
          companyId: l2Chain.id,
          role: "ADMIN",
        },
      },
    },
  });

  // ===========================================
  // Roles
  // ===========================================
  console.log("📋 Creating roles...");

  const solidityRole = await prisma.role.create({
    data: {
      companyId: defiProtocol.id,
      title: "Senior Solidity Engineer",
      description: `We're looking for a Senior Solidity Engineer to join our core protocol team. You'll be working on cutting-edge DeFi primitives including AMMs, lending protocols, and derivatives.

You'll collaborate with a world-class team of smart contract engineers and security researchers to build secure, gas-efficient, and innovative protocols.`,
      requirements: `- 3+ years of Solidity development experience
- Deep understanding of DeFi protocols (AMMs, lending, derivatives)
- Experience with gas optimization and security best practices
- Familiarity with Foundry, Hardhat, or similar tooling
- Track record of deployed mainnet contracts
- Security mindset and experience with audits`,
      responsibilities: `- Design and implement core protocol smart contracts
- Collaborate with security team on audits and fixes
- Optimize gas usage across the protocol
- Write comprehensive test suites
- Participate in code reviews and architecture decisions`,
      location: "Remote",
      locationType: "REMOTE",
      salaryMin: 180000,
      salaryMax: 280000,
      salaryCurrency: "USD",
      commissionType: CommissionType.PERCENTAGE,
      commissionValue: 20, // 20% of first year salary
      status: RoleStatus.LIVE,
      accessModel: RoleAccessModel.REQUEST,
      publishedAt: new Date(),
      cryptoTags: ["DeFi", "Smart Contracts", "Security"],
      techStack: ["Solidity", "Foundry", "EVM", "TypeScript"],
      experienceLevel: "Senior",
      screeningQuestions: JSON.stringify([
        {
          id: "q1",
          question: "Describe a complex DeFi protocol you've built or contributed to. What were the key technical challenges?",
          required: true,
        },
        {
          id: "q2",
          question: "How do you approach gas optimization in smart contracts? Give a specific example.",
          required: true,
        },
        {
          id: "q3",
          question: "What security vulnerabilities are you most concerned about in DeFi, and how do you mitigate them?",
          required: true,
        },
      ]),
    },
  });

  const bdRole = await prisma.role.create({
    data: {
      companyId: defiProtocol.id,
      title: "Business Development Lead - DeFi Partnerships",
      description: `We're seeking a Business Development Lead to drive strategic partnerships across the DeFi ecosystem. You'll be responsible for identifying, negotiating, and closing partnership deals with protocols, DAOs, and institutional players.`,
      requirements: `- 4+ years in business development, preferably in crypto/DeFi
- Strong network in the DeFi ecosystem
- Experience negotiating partnership agreements
- Understanding of DeFi protocols and tokenomics
- Excellent communication and presentation skills`,
      responsibilities: `- Identify and pursue strategic partnership opportunities
- Negotiate partnership terms and agreements
- Represent the protocol at conferences and events
- Collaborate with product team on integration requirements
- Build and maintain relationships with key ecosystem players`,
      location: "Remote",
      locationType: "REMOTE",
      salaryMin: 150000,
      salaryMax: 220000,
      salaryCurrency: "USD",
      commissionType: CommissionType.PERCENTAGE,
      commissionValue: 18,
      status: RoleStatus.LIVE,
      accessModel: RoleAccessModel.OPEN,
      publishedAt: new Date(),
      cryptoTags: ["DeFi", "Partnerships", "Business Development"],
      techStack: [],
      experienceLevel: "Senior",
    },
  });

  const rustRole = await prisma.role.create({
    data: {
      companyId: l2Chain.id,
      title: "Rust Protocol Engineer",
      description: `Join our core team building high-performance Layer 2 infrastructure in Rust. You'll work on the sequencer, prover, and node implementations.`,
      requirements: `- 3+ years of Rust development experience
- Experience with distributed systems
- Understanding of blockchain consensus mechanisms
- Familiarity with zero-knowledge proofs is a plus
- Strong computer science fundamentals`,
      responsibilities: `- Design and implement core L2 components
- Optimize performance and throughput
- Write comprehensive documentation
- Participate in protocol design discussions`,
      location: "San Francisco, CA",
      locationType: "HYBRID",
      salaryMin: 200000,
      salaryMax: 300000,
      salaryCurrency: "USD",
      commissionType: CommissionType.FIXED,
      commissionValue: 50000,
      status: RoleStatus.LIVE,
      accessModel: RoleAccessModel.INVITE_ONLY,
      publishedAt: new Date(),
      cryptoTags: ["L2", "Infrastructure", "Zero Knowledge"],
      techStack: ["Rust", "Go", "PostgreSQL", "gRPC"],
      experienceLevel: "Senior",
      takeRateOverride: 10, // Lower take rate for this specific role
    },
  });

  // ===========================================
  // Role Fit Archetypes
  // ===========================================
  console.log("🎯 Creating role fit archetypes...");

  await prisma.roleFitArchetype.createMany({
    data: [
      {
        archetypeName: "Solidity Engineer",
        description: "Smart contract developer specializing in EVM-compatible chains and DeFi protocols.",
        requiredSkills: ["Solidity", "EVM", "Smart Contracts", "Testing"],
        preferredSkills: ["Foundry", "Hardhat", "Security Auditing", "Gas Optimization"],
        cryptoKnowledge: ["DeFi", "AMMs", "Lending Protocols", "Token Standards"],
        experienceLevel: "Mid to Senior",
      },
      {
        archetypeName: "Rust Blockchain Engineer",
        description: "Systems programmer building core blockchain infrastructure in Rust.",
        requiredSkills: ["Rust", "Systems Programming", "Distributed Systems"],
        preferredSkills: ["Substrate", "Zero Knowledge", "Consensus Mechanisms"],
        cryptoKnowledge: ["L1/L2 Architecture", "Consensus", "P2P Networking"],
        experienceLevel: "Senior",
      },
      {
        archetypeName: "DeFi Business Development",
        description: "Business development professional focused on DeFi partnerships and ecosystem growth.",
        requiredSkills: ["Business Development", "Partnerships", "Negotiation"],
        preferredSkills: ["DeFi Knowledge", "Tokenomics", "DAO Governance"],
        cryptoKnowledge: ["DeFi Ecosystem", "Protocol Integrations", "Liquidity"],
        experienceLevel: "Mid to Senior",
      },
      {
        archetypeName: "Frontend Web3 Developer",
        description: "Frontend developer building dApp interfaces and wallet integrations.",
        requiredSkills: ["React", "TypeScript", "Web3.js/Ethers.js"],
        preferredSkills: ["Wagmi", "RainbowKit", "The Graph"],
        cryptoKnowledge: ["Wallet Integration", "Transaction Signing", "ENS"],
        experienceLevel: "Mid",
      },
      {
        archetypeName: "Security Researcher",
        description: "Security professional focused on smart contract auditing and vulnerability research.",
        requiredSkills: ["Smart Contract Security", "Auditing", "Solidity"],
        preferredSkills: ["Formal Verification", "Fuzzing", "Static Analysis"],
        cryptoKnowledge: ["Common Vulnerabilities", "DeFi Exploits", "MEV"],
        experienceLevel: "Senior",
      },
      {
        archetypeName: "DevRel / Developer Advocate",
        description: "Developer relations professional focused on community and ecosystem growth.",
        requiredSkills: ["Technical Writing", "Public Speaking", "Community Building"],
        preferredSkills: ["SDK Development", "Documentation", "Workshop Facilitation"],
        cryptoKnowledge: ["Developer Tools", "API/SDK Usage", "Ecosystem"],
        experienceLevel: "Mid",
      },
    ],
  });

  // ===========================================
  // Approved Recruiter
  // ===========================================
  console.log("🧑‍💼 Creating approved recruiter...");

  const approvedRecruiter = await prisma.user.create({
    data: {
      email: "alice@recruiting.example",
      name: "Alice Recruiter",
      emailVerified: new Date(),
      role: UserRole.RECRUITER,
      recruiterProfile: {
        create: {
          status: RecruiterStatus.APPROVED,
          fullName: "Alice Johnson",
          phone: "+1-555-123-4567",
          linkedinUrl: "https://linkedin.com/in/alicejohnson",
          location: "New York, NY",
          timezone: "America/New_York",
          experienceYears: 8,
          specializations: ["Engineering", "Product", "Executive"],
          cryptoExperience: true,
          cryptoSpecializations: ["DeFi", "Infrastructure", "Security"],
          bio: "Experienced tech recruiter with 8 years in the industry, specializing in crypto and DeFi talent.",
          phoneVerifiedAt: new Date(),
          approvedAt: new Date(),
          approvedBy: admin.id,
        },
      },
    },
  });

  // Grant access to some roles
  await prisma.roleAccess.create({
    data: {
      roleId: solidityRole.id,
      recruiterId: (await prisma.recruiterProfile.findUnique({ where: { userId: approvedRecruiter.id } }))!.id,
      status: "APPROVED",
      respondedAt: new Date(),
      respondedBy: defiAdmin.id,
    },
  });

  await prisma.roleAccess.create({
    data: {
      roleId: bdRole.id,
      recruiterId: (await prisma.recruiterProfile.findUnique({ where: { userId: approvedRecruiter.id } }))!.id,
      status: "APPROVED",
      respondedAt: new Date(),
    },
  });

  // ===========================================
  // Pending Recruiter
  // ===========================================
  console.log("🧑‍💼 Creating pending recruiter...");

  await prisma.user.create({
    data: {
      email: "bob@recruiting.example",
      name: "Bob Recruiter",
      emailVerified: new Date(),
      role: UserRole.RECRUITER,
      recruiterProfile: {
        create: {
          status: RecruiterStatus.PENDING_APPROVAL,
          fullName: "Bob Smith",
          phone: "+1-555-987-6543",
          linkedinUrl: "https://linkedin.com/in/bobsmith",
          location: "San Francisco, CA",
          timezone: "America/Los_Angeles",
          experienceYears: 3,
          specializations: ["Engineering"],
          cryptoExperience: false,
          bio: "Tech recruiter looking to break into the crypto space.",
        },
      },
    },
  });

  // ===========================================
  // Community Candidate with Completed Assessments
  // ===========================================
  console.log("👩‍💻 Creating community candidate with assessments...");

  const candidateUser = await prisma.user.create({
    data: {
      email: "dev@example.com",
      name: "Dana Developer",
      emailVerified: new Date(),
      role: UserRole.CANDIDATE,
    },
  });

  const candidateProfile = await prisma.candidateProfile.create({
    data: {
      userId: candidateUser.id,
      status: CandidateProfileStatus.ACTIVE,
      fullName: "Dana Developer",
      location: "Austin, TX",
      timezone: "America/Chicago",
      desiredRoleTitles: ["Solidity Engineer", "Smart Contract Developer"],
      experienceLevel: "Mid",
      availability: AvailabilityType.THIRTY_DAYS,
      remotePreference: "remote",
      cryptoInterests: ["DeFi", "NFTs", "L2"],
      linkedinUrl: "https://linkedin.com/in/danadev",
      githubUrl: "https://github.com/danadev",
      twitterUrl: "https://twitter.com/danadev",
      resumeUrl: "https://storage.example.com/resumes/dana-dev.pdf",
      resumeTextSnapshot: `Dana Developer
Senior Software Engineer | Blockchain Enthusiast

EXPERIENCE
- Blockchain Developer at Web3 Startup (2022-Present)
  - Built and deployed 5 smart contracts on Ethereum mainnet
  - Implemented ERC-20 and ERC-721 token standards
  - Reduced gas costs by 40% through optimization

- Full Stack Developer at Tech Corp (2019-2022)
  - Led development of React-based dashboard
  - Implemented REST APIs with Node.js
  - Managed PostgreSQL database with 1M+ records

SKILLS
- Solidity, JavaScript, TypeScript, Python
- React, Node.js, Express
- Hardhat, Foundry, ethers.js
- PostgreSQL, MongoDB, Redis

EDUCATION
- BS Computer Science, University of Texas (2019)

PROJECTS
- DeFi Lending Protocol (personal project)
- NFT Marketplace Smart Contracts
- DAO Governance Implementation`,
      consentToProcess: true,
      consentToProcessAt: new Date(),
      consentToAnalyzeFootprint: true,
      consentToAnalyzeGithub: true,
      consentToBeContacted: true,
      discoverable: true,
      completenessScore: 95,
    },
  });

  // Create verification
  await prisma.candidateVerification.create({
    data: {
      candidateId: candidateProfile.id,
      emailVerifiedAt: new Date(),
      githubProofVerifiedAt: new Date(),
      methodUsed: "github_gist",
    },
  });

  // Create assessment run
  const assessmentRun = await prisma.candidateAssessmentRun.create({
    data: {
      candidateId: candidateProfile.id,
      triggeredBy: "system",
      status: AssessmentRunStatus.SUCCEEDED,
      assessmentTypes: ["crypto_score", "tech_score", "employability_plan", "role_fit"],
      provider: "mock",
      model: "mock-v1",
      startedAt: new Date(Date.now() - 60000),
      completedAt: new Date(),
    },
  });

  // Create crypto score
  await prisma.candidateCryptoScore.create({
    data: {
      candidateId: candidateProfile.id,
      runId: assessmentRun.id,
      cryptoNativeScore: 72,
      rationale: `Dana shows strong crypto-native indicators:
- Active GitHub with blockchain projects
- Resume mentions specific DeFi protocols and standards
- Experience with smart contract development and deployment
- Understanding of gas optimization

Areas for improvement:
- Could benefit from more DAO/governance experience
- Limited L2 experience mentioned
- No security audit experience noted`,
      confidence: 0.85,
      flags: null,
    },
  });

  // Create tech score
  await prisma.candidateTechScore.create({
    data: {
      candidateId: candidateProfile.id,
      runId: assessmentRun.id,
      scoresJson: {
        "Solidity": 78,
        "JavaScript": 85,
        "TypeScript": 82,
        "React": 80,
        "Smart Contracts": 75,
        "Testing": 70,
        "Gas Optimization": 65,
      },
      overallScore: 76,
      githubUsername: "danadev",
      reposAnalyzed: 12,
    },
  });

  // Create employability plan
  await prisma.candidateEmployabilityPlan.create({
    data: {
      candidateId: candidateProfile.id,
      runId: assessmentRun.id,
      planJson: {
        headlineSummary: "Dana is a promising Solidity developer with solid fundamentals and real mainnet experience. Focus on deepening DeFi expertise and building security knowledge to reach senior level.",
        topStrengths: [
          "Mainnet deployment experience with 5+ contracts",
          "Strong JavaScript/TypeScript foundation",
          "Demonstrated gas optimization skills (40% reduction)",
          "Full-stack capabilities for dApp development",
        ],
        biggestGaps: [
          "Limited formal security audit experience",
          "No L2 deployment experience mentioned",
          "Could strengthen DAO governance knowledge",
          "Foundry experience not demonstrated",
        ],
        thirtyDayPlan: {
          projectsToBuild: [
            "Build a simple AMM (Uniswap V2 style) with comprehensive tests",
            "Deploy a contract on Optimism or Arbitrum",
            "Implement a basic governance token with voting",
          ],
          learningResources: [
            "Foundry Book - complete the tutorials",
            "Secureum bootcamp materials",
            "Damn Vulnerable DeFi challenges",
          ],
          portfolioImprovements: [
            "Add detailed README to all GitHub projects",
            "Write a blog post about your gas optimization techniques",
            "Create architecture diagrams for complex projects",
          ],
          networkingActions: [
            "Join ETHGlobal Discord and participate in discussions",
            "Attend local Ethereum meetup",
            "Comment on interesting protocol proposals",
          ],
        },
        sixtyDayPlan: {
          projectsToBuild: [
            "Build a flash loan arbitrage bot (testnet)",
            "Implement a merkle airdrop contract",
            "Create a multisig wallet implementation",
          ],
          learningResources: [
            "Study recent DeFi exploits and post-mortems",
            "Deep dive into EVM internals",
            "Learn formal verification basics with Certora",
          ],
          portfolioImprovements: [
            "Contribute to an open-source DeFi protocol",
            "Get a security researcher to review one of your contracts",
          ],
          networkingActions: [
            "Apply to participate in an ETHGlobal hackathon",
            "Start engaging with security researchers on Twitter",
          ],
        },
        ninetyDayPlan: {
          projectsToBuild: [
            "Participate in a hackathon and build something novel",
            "Complete all Damn Vulnerable DeFi challenges",
            "Build a yield aggregator or vault strategy",
          ],
          learningResources: [
            "Study ZK basics if interested in L2 development",
            "Read EIPs related to your area of interest",
          ],
          portfolioImprovements: [
            "Have 3+ polished projects with documentation",
            "Build a personal site showcasing your work",
          ],
          networkingActions: [
            "Apply to DeFi protocols directly",
            "Reach out to recruiters specializing in crypto",
            "Consider applying to grants programs",
          ],
        },
        suggestedRolesToPursue: [
          "Smart Contract Engineer at DeFi protocols",
          "Solidity Developer at L2 teams",
          "Full-stack Web3 Developer at dApp teams",
        ],
        suggestedKeywordsForCV: [
          "Solidity", "DeFi", "Smart Contracts", "EVM", "Foundry",
          "Gas Optimization", "ERC-20", "ERC-721", "Hardhat",
          "Web3", "Ethereum", "Mainnet Deployment",
        ],
        suggestedInterviewPrep: [
          "Practice explaining reentrancy attacks and prevention",
          "Be ready to discuss your gas optimization techniques with examples",
          "Prepare to whiteboard a simple AMM implementation",
          "Review ERC token standards deeply",
          "Be ready to discuss your mainnet deployment experience",
        ],
        confidence: 0.82,
        caveats: "Assessment based on resume and GitHub profile. Actual technical depth should be verified through coding interviews.",
      },
    },
  });

  // Create role fit assessments
  await prisma.candidateRoleFitAssessment.create({
    data: {
      candidateId: candidateProfile.id,
      runId: assessmentRun.id,
      desiredRoleTitle: "Solidity Engineer",
      fitScore: 75,
      reasonsJson: {
        whyFit: [
          "Has mainnet deployment experience",
          "Demonstrated gas optimization skills",
          "Solid understanding of token standards",
          "Full-stack skills complement smart contract work",
        ],
        missingSkills: [
          "No formal security audit experience",
          "Foundry experience not explicitly shown",
          "Limited DeFi protocol depth (AMMs, lending)",
        ],
        recommendedNextSteps: [
          "Complete Damn Vulnerable DeFi to demonstrate security awareness",
          "Build and deploy an AMM to show DeFi understanding",
          "Migrate existing projects to Foundry",
        ],
      },
    },
  });

  await prisma.candidateRoleFitAssessment.create({
    data: {
      candidateId: candidateProfile.id,
      runId: assessmentRun.id,
      desiredRoleTitle: "Smart Contract Developer",
      fitScore: 78,
      reasonsJson: {
        whyFit: [
          "Direct smart contract development experience",
          "Multiple deployed contracts",
          "Understanding of multiple token standards",
          "Testing experience mentioned",
        ],
        missingSkills: [
          "Could strengthen formal verification knowledge",
          "No upgradeable contract experience mentioned",
        ],
        recommendedNextSteps: [
          "Learn proxy patterns and upgradeable contracts",
          "Explore formal verification tools",
        ],
      },
    },
  });

  // ===========================================
  // Recruiter-submitted Candidate with Pending Verification
  // ===========================================
  console.log("📝 Creating recruiter-submitted candidate...");

  const recruiterProfile = await prisma.recruiterProfile.findUnique({
    where: { userId: approvedRecruiter.id },
  });

  const submission = await prisma.candidateSubmission.create({
    data: {
      roleId: solidityRole.id,
      recruiterId: recruiterProfile!.id,
      candidateName: "Eric Engineer",
      candidateEmail: "eric@engineer.example",
      candidatePhone: "+1-555-222-3333",
      candidateLinkedin: "https://linkedin.com/in/ericengineer",
      candidateGithub: "https://github.com/ericeng",
      resumeUrl: "https://storage.example.com/resumes/eric-eng.pdf",
      resumeText: `Eric Engineer
Blockchain Engineer | DeFi Specialist

EXPERIENCE
- Senior Smart Contract Engineer at DeFi Labs (2021-Present)
  - Lead developer for $50M TVL lending protocol
  - Designed and implemented novel liquidation mechanism
  - Passed 3 security audits with no critical findings

- Blockchain Developer at Crypto Exchange (2019-2021)
  - Built custody solution for 10+ ERC-20 tokens
  - Implemented automated trading strategies

SKILLS
- Solidity, Rust, TypeScript
- Foundry, Hardhat, Anchor
- DeFi: Aave, Compound, Uniswap internals

EDUCATION
- MS Computer Science, MIT (2019)`,
      coverNote: "Eric is a strong candidate I've worked with before. He led the development of a successful lending protocol and has deep DeFi experience.",
      candidateConsent: true,
      consentTimestamp: new Date(),
      recruiterAttestation: true,
      attestationTimestamp: new Date(),
      status: "INTERVIEWING",
      statusHistory: JSON.stringify([
        { status: "SUBMITTED", timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), by: recruiterProfile!.id },
        { status: "SCREENING", timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), by: defiAdmin.id },
        { status: "INTERVIEWING", timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), by: defiAdmin.id },
      ]),
      aiSummary: `**Candidate Summary: Eric Engineer**

**Overall Fit: Strong (85/100)**

Eric is a highly qualified Senior Solidity Engineer with direct experience building and maintaining production DeFi protocols. His background aligns well with the role requirements.

**Key Strengths:**
- Led development of a $50M TVL lending protocol
- 3 successful security audits with no critical findings
- Deep understanding of DeFi primitives (Aave, Compound, Uniswap)
- MS in Computer Science from MIT

**Considerations:**
- Currently employed; standard notice period expected
- Salary expectations may be at higher end of range given experience level

**Recommended Next Steps:**
- Technical deep-dive on lending protocol architecture
- Security-focused coding exercise
- Culture fit conversation with team leads`,
      aiSummaryGeneratedAt: new Date(),
      screeningAnswers: JSON.stringify([
        {
          questionId: "q1",
          answer: "I led the development of a lending protocol that reached $50M TVL. Key challenges included designing a novel liquidation mechanism that was both gas-efficient and MEV-resistant, and implementing dynamic interest rate curves based on utilization.",
        },
        {
          questionId: "q2",
          answer: "For gas optimization, I focus on: 1) Minimizing storage operations using memory efficiently, 2) Packing structs to reduce slots, 3) Using unchecked blocks where overflow is impossible, 4) Implementing efficient data structures. For our lending protocol, I reduced the liquidation function gas cost by 35% through careful optimization.",
        },
        {
          questionId: "q3",
          answer: "Top concerns: reentrancy, oracle manipulation, flash loan attacks, and governance attacks. Mitigations include: checks-effects-interactions pattern, TWAP oracles with delay, minimum borrow times, and timelocks with delays on governance actions. We also do extensive fuzzing and formal verification on critical paths.",
        },
      ]),
    },
  });

  // Create scoring for submission
  await prisma.candidateScoring.create({
    data: {
      submissionId: submission.id,
      cryptoNativeScore: 92,
      cryptoScoreRationale: "Very strong crypto-native profile. Led development of production DeFi protocol with significant TVL. Deep understanding of DeFi primitives demonstrated in screening answers. Security-conscious with audit track record.",
      cryptoScoreConfidence: 0.92,
      techScores: {
        "Solidity": 95,
        "DeFi": 90,
        "Security": 88,
        "Testing": 85,
        "Architecture": 88,
      },
      techOverallScore: 89,
      roleFitScore: 88,
      roleFitRationale: "Excellent fit for Senior Solidity Engineer role. Exceeds experience requirements with production DeFi leadership. Strong security focus aligns with role needs.",
    },
  });

  // ===========================================
  // Hidden Talent Matches
  // ===========================================
  console.log("🎯 Creating hidden talent matches...");

  await prisma.hiddenTalentMatch.create({
    data: {
      roleId: solidityRole.id,
      candidateProfileId: candidateProfile.id,
      matchScore: 0.75,
      matchReasons: [
        "Candidate has Solidity experience matching role requirements",
        "Crypto interests align with DeFi focus",
        "Experience level (Mid) slightly below Senior requirement but strong skills",
        "Remote preference matches role location type",
      ],
    },
  });

  // ===========================================
  // Print Summary
  // ===========================================
  console.log("\n✅ Seed completed successfully!\n");
  console.log("===========================================");
  console.log("Demo Accounts (use magic link login):");
  console.log("===========================================");
  console.log("Platform Admin:     admin@techchain.io");
  console.log("Company Admin:      hiring@defiprotocol.example");
  console.log("Approved Recruiter: alice@recruiting.example");
  console.log("Pending Recruiter:  bob@recruiting.example");
  console.log("Candidate:          dev@example.com");
  console.log("===========================================\n");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
