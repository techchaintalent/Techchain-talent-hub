import { env, isDevMode } from "../env";

export interface GitHubProfile {
  login: string;
  name: string | null;
  bio: string | null;
  public_repos: number;
  followers: number;
  following: number;
  created_at: string;
  avatar_url: string;
  html_url: string;
}

export interface GitHubRepo {
  name: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  updated_at: string;
  topics: string[];
}

// Mock data for dev mode
const MOCK_PROFILE: GitHubProfile = {
  login: "mockuser",
  name: "Mock Developer",
  bio: "Blockchain enthusiast building cool stuff",
  public_repos: 25,
  followers: 150,
  following: 75,
  created_at: "2019-01-15T00:00:00Z",
  avatar_url: "https://avatars.githubusercontent.com/u/1234567",
  html_url: "https://github.com/mockuser",
};

const MOCK_REPOS: GitHubRepo[] = [
  {
    name: "defi-protocol",
    description: "A simple DeFi lending protocol",
    language: "Solidity",
    stargazers_count: 45,
    forks_count: 12,
    updated_at: "2024-01-15T00:00:00Z",
    topics: ["defi", "ethereum", "solidity"],
  },
  {
    name: "nft-marketplace",
    description: "NFT marketplace smart contracts",
    language: "Solidity",
    stargazers_count: 23,
    forks_count: 8,
    updated_at: "2024-02-01T00:00:00Z",
    topics: ["nft", "ethereum", "marketplace"],
  },
  {
    name: "web3-frontend",
    description: "React frontend for dApps",
    language: "TypeScript",
    stargazers_count: 18,
    forks_count: 5,
    updated_at: "2024-02-15T00:00:00Z",
    topics: ["react", "web3", "typescript"],
  },
  {
    name: "rust-node",
    description: "Blockchain node implementation in Rust",
    language: "Rust",
    stargazers_count: 67,
    forks_count: 15,
    updated_at: "2024-01-20T00:00:00Z",
    topics: ["blockchain", "rust", "p2p"],
  },
];

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "TechChain-Talent-Hub",
  };

  if (env.GITHUB_TOKEN) {
    headers.Authorization = `token ${env.GITHUB_TOKEN}`;
  }

  return headers;
}

export async function fetchGitHubProfile(username: string): Promise<GitHubProfile> {
  if (isDevMode() && !env.GITHUB_TOKEN) {
    console.log(`[MockGitHub] Returning mock profile for ${username}`);
    return { ...MOCK_PROFILE, login: username };
  }

  const response = await fetch(`https://api.github.com/users/${username}`, {
    headers: getHeaders(),
  });

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status}`);
  }

  return response.json();
}

export async function fetchGitHubRepos(
  username: string,
  limit: number = 30
): Promise<GitHubRepo[]> {
  if (isDevMode() && !env.GITHUB_TOKEN) {
    console.log(`[MockGitHub] Returning mock repos for ${username}`);
    return MOCK_REPOS;
  }

  const response = await fetch(
    `https://api.github.com/users/${username}/repos?sort=updated&per_page=${limit}`,
    { headers: getHeaders() }
  );

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status}`);
  }

  return response.json();
}

export async function analyzeGitHubTechStack(
  username: string
): Promise<Record<string, number>> {
  const repos = await fetchGitHubRepos(username);

  const languageCounts: Record<string, number> = {};

  for (const repo of repos) {
    if (repo.language) {
      languageCounts[repo.language] = (languageCounts[repo.language] || 0) + 1;
    }
  }

  return languageCounts;
}

export interface GitHubAnalysis {
  profile: GitHubProfile;
  repoCount: number;
  topLanguages: { language: string; count: number }[];
  cryptoRelatedRepos: number;
  totalStars: number;
  recentActivity: boolean;
  accountAge: number; // in days
}

export async function analyzeGitHubProfile(username: string): Promise<GitHubAnalysis> {
  const [profile, repos] = await Promise.all([
    fetchGitHubProfile(username),
    fetchGitHubRepos(username, 100),
  ]);

  // Count languages
  const languageCounts: Record<string, number> = {};
  let totalStars = 0;
  let cryptoRelatedRepos = 0;

  const cryptoKeywords = [
    "blockchain",
    "crypto",
    "defi",
    "nft",
    "ethereum",
    "solidity",
    "web3",
    "smart-contract",
    "dapp",
    "token",
    "wallet",
    "dao",
  ];

  const now = new Date();
  const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  let recentActivity = false;

  for (const repo of repos) {
    if (repo.language) {
      languageCounts[repo.language] = (languageCounts[repo.language] || 0) + 1;
    }

    totalStars += repo.stargazers_count;

    // Check for crypto-related content
    const isCrypto =
      cryptoKeywords.some(
        (kw) =>
          repo.name.toLowerCase().includes(kw) ||
          repo.description?.toLowerCase().includes(kw) ||
          repo.topics.some((t) => t.toLowerCase().includes(kw))
      ) || repo.language === "Solidity";

    if (isCrypto) {
      cryptoRelatedRepos++;
    }

    // Check for recent activity
    if (new Date(repo.updated_at) > threeMonthsAgo) {
      recentActivity = true;
    }
  }

  // Sort languages by count
  const topLanguages = Object.entries(languageCounts)
    .map(([language, count]) => ({ language, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Calculate account age
  const createdAt = new Date(profile.created_at);
  const accountAge = Math.floor(
    (now.getTime() - createdAt.getTime()) / (24 * 60 * 60 * 1000)
  );

  return {
    profile,
    repoCount: repos.length,
    topLanguages,
    cryptoRelatedRepos,
    totalStars,
    recentActivity,
    accountAge,
  };
}

export function calculateGitHubScore(analysis: GitHubAnalysis): {
  score: number;
  breakdown: Record<string, number>;
} {
  const breakdown: Record<string, number> = {};

  // Account age (max 15 points)
  breakdown.accountAge = Math.min(15, Math.floor(analysis.accountAge / 365) * 5);

  // Repository count (max 20 points)
  breakdown.repoCount = Math.min(20, analysis.repoCount);

  // Stars (max 15 points)
  breakdown.stars = Math.min(15, Math.floor(analysis.totalStars / 10));

  // Crypto repos (max 25 points)
  breakdown.cryptoRepos = Math.min(25, analysis.cryptoRelatedRepos * 5);

  // Language diversity (max 10 points)
  breakdown.languageDiversity = Math.min(10, analysis.topLanguages.length * 2);

  // Recent activity (10 points)
  breakdown.recentActivity = analysis.recentActivity ? 10 : 0;

  // Solidity presence (5 points)
  breakdown.solidity = analysis.topLanguages.some(
    (l) => l.language === "Solidity"
  )
    ? 5
    : 0;

  const score = Object.values(breakdown).reduce((a, b) => a + b, 0);

  return { score: Math.min(100, score), breakdown };
}
