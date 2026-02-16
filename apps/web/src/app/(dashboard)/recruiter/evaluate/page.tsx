"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";

// ─── Types (mirroring server schemas) ────────────────────────────────────────

interface TargetRoleBrief {
  title: string;
  seniority: string;
  mustHaveSkills: string[];
  niceToHaveSkills: string[];
  domain: string;
  location: string;
  timezone: string;
  workModel: "remote" | "hybrid" | "on-site" | "flexible";
  yearsOfExperienceMin: number;
  yearsOfExperienceMax: number;
  dealbreakers: string[];
  compensationBand: string;
  whatGreatLooksLike: string[];
  outreachValueProp: string[];
}

interface CandidateSnippet {
  id: string;
  name: string;
  headline: string;
  about: string;
  experience: string;
  skills: string;
  location: string;
  rawText: string;
}

interface CategoryScore {
  score: number;
  maxScore: number;
  justification: string;
}

interface EvaluatedCandidate {
  id: string;
  name: string;
  totalScore: number;
  confidence: "High" | "Med" | "Low";
  breakdown: {
    coreMustHavesFit: CategoryScore;
    relevantScopeSeniority: CategoryScore;
    domainIndustryRelevance: CategoryScore;
    evidenceImpactMetrics: CategoryScore;
    stabilityTrajectory: CategoryScore;
    locationWorkModelAlignment: CategoryScore;
    bonusSignals: CategoryScore;
  };
  hookLines: string[];
  concerns: string[];
  suggestedAngle: string;
  extractedFacts: {
    currentRole?: string;
    yearsExperience?: string;
    relevantSkills?: string[];
    notableAchievements?: string[];
    location?: string;
  };
  dealbreakersFound: string[];
}

interface OutreachDrafts {
  candidateId: string;
  candidateName: string;
  shortDraft1: string;
  mediumDraft1: string;
  shortDraft2: string;
  mediumDraft2: string;
}

interface EvaluationResult {
  roleSummary: string;
  scoringRubric: Record<string, string>;
  rankedShortlist: EvaluatedCandidate[];
  maybes: EvaluatedCandidate[];
  doNotContact: { id: string; name: string; reason: string }[];
  outreachDrafts: OutreachDrafts[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseCommaSeparated(val: string): string[] {
  return val
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseCandidateBlocks(text: string): CandidateSnippet[] {
  // Split by "---" or "CANDIDATE" or numbered patterns like "1." "2."
  const blocks = text.split(/(?:^|\n)(?:---+|CANDIDATE\s*\d*[:.]?)/i).filter((b) => b.trim());

  if (blocks.length === 0) {
    // Treat entire text as one candidate
    return [
      {
        id: "C1",
        name: extractField(text, "name") || "Unknown",
        headline: extractField(text, "headline") || extractField(text, "title") || "",
        about: extractField(text, "about") || extractField(text, "summary") || "",
        experience: extractField(text, "experience") || "",
        skills: extractField(text, "skills") || "",
        location: extractField(text, "location") || "Unknown",
        rawText: text.trim(),
      },
    ];
  }

  return blocks.map((block, i) => ({
    id: extractField(block, "id") || `C${i + 1}`,
    name: extractField(block, "name") || "Unknown",
    headline: extractField(block, "headline") || extractField(block, "title") || "",
    about: extractField(block, "about") || extractField(block, "summary") || "",
    experience: extractField(block, "experience") || "",
    skills: extractField(block, "skills") || "",
    location: extractField(block, "location") || "Unknown",
    rawText: block.trim(),
  }));
}

function extractField(text: string, field: string): string {
  const regex = new RegExp(`(?:^|\\n)\\s*${field}\\s*[:=]\\s*(.+?)(?:\\n|$)`, "i");
  const match = text.match(regex);
  return match?.[1]?.trim() || "";
}

function confidenceBadgeVariant(c: string): "default" | "secondary" | "outline" {
  if (c === "High") return "default";
  if (c === "Med") return "secondary";
  return "outline";
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function EvaluateCandidatesPage() {
  // Form state
  const [title, setTitle] = useState("");
  const [seniority, setSeniority] = useState("");
  const [mustHaveSkills, setMustHaveSkills] = useState("");
  const [niceToHaveSkills, setNiceToHaveSkills] = useState("");
  const [domain, setDomain] = useState("");
  const [location, setLocation] = useState("");
  const [timezone, setTimezone] = useState("");
  const [workModel, setWorkModel] = useState<"remote" | "hybrid" | "on-site" | "flexible">("remote");
  const [yoeMin, setYoeMin] = useState("3");
  const [yoeMax, setYoeMax] = useState("8");
  const [dealbreakers, setDealbreakers] = useState("");
  const [compensationBand, setCompensationBand] = useState("");
  const [whatGreatLooksLike, setWhatGreatLooksLike] = useState("");
  const [outreachValueProp, setOutreachValueProp] = useState("");
  const [candidatesText, setCandidatesText] = useState("");

  // Result state
  const [result, setResult] = useState<EvaluationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clarifyingQuestions, setClarifyingQuestions] = useState<string[]>([]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    setClarifyingQuestions([]);

    const candidates = parseCandidateBlocks(candidatesText);

    const roleBrief: TargetRoleBrief = {
      title,
      seniority,
      mustHaveSkills: parseCommaSeparated(mustHaveSkills),
      niceToHaveSkills: parseCommaSeparated(niceToHaveSkills),
      domain,
      location,
      timezone,
      workModel,
      yearsOfExperienceMin: parseInt(yoeMin) || 0,
      yearsOfExperienceMax: parseInt(yoeMax) || 99,
      dealbreakers: parseCommaSeparated(dealbreakers),
      compensationBand,
      whatGreatLooksLike: whatGreatLooksLike.split("\n").filter(Boolean),
      outreachValueProp: outreachValueProp.split("\n").filter(Boolean),
    };

    try {
      const res = await fetch("/api/recruiter/evaluate-candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleBrief, candidates }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.incomplete) {
          setClarifyingQuestions(data.clarifyingQuestions || []);
          setError("Please fill in the missing role brief fields before evaluating.");
        } else {
          setError(data.error || "Evaluation failed");
        }
        return;
      }

      setResult(data);
    } catch (err: any) {
      setError(err.message || "Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Candidate Evaluation Ranker</h1>
        <p className="text-muted-foreground">
          Paste candidate profiles and a role brief to get a scored, ranked shortlist with outreach drafts.
        </p>
      </div>

      {/* ─── Input Form ─────────────────────────────────────────────── */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Target Role Brief</CardTitle>
            <CardDescription>Define the role you are sourcing for</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Senior Solidity Engineer" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="seniority">Seniority *</Label>
                <Input id="seniority" value={seniority} onChange={(e) => setSeniority(e.target.value)} placeholder="Senior / Lead" required />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="mustHaveSkills">Must-have skills (comma separated, max 8) *</Label>
              <Input
                id="mustHaveSkills"
                value={mustHaveSkills}
                onChange={(e) => setMustHaveSkills(e.target.value)}
                placeholder="Solidity, EVM, DeFi, Auditing, TypeScript"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="niceToHaveSkills">Nice-to-have skills (comma separated)</Label>
              <Input
                id="niceToHaveSkills"
                value={niceToHaveSkills}
                onChange={(e) => setNiceToHaveSkills(e.target.value)}
                placeholder="Rust, Go, ZK proofs"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="domain">Domain / Industry</Label>
                <Input id="domain" value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="DeFi, L2 Infrastructure" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Location *</Label>
                <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="US / Europe / Global" required />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Input id="timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder="UTC-5 to UTC+1" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="workModel">Work model *</Label>
                <select
                  id="workModel"
                  value={workModel}
                  onChange={(e) => setWorkModel(e.target.value as any)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="remote">Remote</option>
                  <option value="hybrid">Hybrid</option>
                  <option value="on-site">On-site</option>
                  <option value="flexible">Flexible</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Experience range (years)</Label>
                <div className="flex gap-2 items-center">
                  <Input type="number" value={yoeMin} onChange={(e) => setYoeMin(e.target.value)} className="w-20" min="0" />
                  <span className="text-muted-foreground">to</span>
                  <Input type="number" value={yoeMax} onChange={(e) => setYoeMax(e.target.value)} className="w-20" min="0" />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dealbreakers">Dealbreakers (comma separated)</Label>
              <Input
                id="dealbreakers"
                value={dealbreakers}
                onChange={(e) => setDealbreakers(e.target.value)}
                placeholder="no agency, no visa sponsorship"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="compensationBand">Compensation band (optional)</Label>
              <Input
                id="compensationBand"
                value={compensationBand}
                onChange={(e) => setCompensationBand(e.target.value)}
                placeholder="$180k–$250k + tokens"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="whatGreatLooksLike">What &quot;great&quot; looks like (one per line, 2-4 bullets) *</Label>
              <Textarea
                id="whatGreatLooksLike"
                value={whatGreatLooksLike}
                onChange={(e) => setWhatGreatLooksLike(e.target.value)}
                placeholder={"Has shipped production DeFi contracts\nCan design protocols from scratch\nStrong security mindset"}
                rows={4}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="outreachValueProp">Outreach value prop (one per line, 2-4 bullets) *</Label>
              <Textarea
                id="outreachValueProp"
                value={outreachValueProp}
                onChange={(e) => setOutreachValueProp(e.target.value)}
                placeholder={"Greenfield protocol design opportunity\nCompetitive comp + meaningful token allocation\nSmall, elite engineering team"}
                rows={4}
                required
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Candidate Data</CardTitle>
            <CardDescription>
              Paste candidate profiles below. Separate each candidate with &quot;---&quot; or &quot;CANDIDATE&quot;. Include fields like
              Name, Headline, About, Experience, Skills, Location.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={candidatesText}
              onChange={(e) => setCandidatesText(e.target.value)}
              placeholder={`CANDIDATE 1
Name: Alice Chen
Headline: Senior Smart Contract Engineer at Uniswap
About: 6 years in DeFi, built AMM core logic...
Experience: Uniswap (3y), Aave (2y), Google (1y)
Skills: Solidity, Vyper, TypeScript, Foundry
Location: San Francisco, CA

---

CANDIDATE 2
Name: Bob Kumar
Headline: Protocol Engineer at Polygon
...`}
              rows={16}
              className="font-mono text-sm"
              required
            />
          </CardContent>
        </Card>

        {clarifyingQuestions.length > 0 && (
          <Card className="border-yellow-500">
            <CardHeader>
              <CardTitle className="text-yellow-600">Missing Information</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc pl-5 space-y-1 text-sm">
                {clarifyingQuestions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {error && !clarifyingQuestions.length && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        <Button type="submit" disabled={loading} className="w-full" size="lg">
          {loading ? "Evaluating candidates..." : "Evaluate & Rank Candidates"}
        </Button>
      </form>

      {/* ─── Results ────────────────────────────────────────────────── */}
      {result && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Role Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="whitespace-pre-wrap text-sm">{result.roleSummary}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Scoring Rubric</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                {Object.entries(result.scoringRubric).map(([key, desc]) => (
                  <div key={key} className="flex gap-2">
                    <span className="font-medium min-w-[200px]">{formatRubricKey(key)}:</span>
                    <span className="text-muted-foreground">{desc}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="shortlist">
            <TabsList>
              <TabsTrigger value="shortlist">
                Shortlist ({result.rankedShortlist.length})
              </TabsTrigger>
              <TabsTrigger value="maybes">
                Maybes ({result.maybes.length})
              </TabsTrigger>
              <TabsTrigger value="dnc">
                Do Not Contact ({result.doNotContact.length})
              </TabsTrigger>
              <TabsTrigger value="outreach">
                Outreach Drafts ({result.outreachDrafts.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="shortlist" className="space-y-4 mt-4">
              {result.rankedShortlist.length === 0 ? (
                <p className="text-muted-foreground text-sm">No candidates met the shortlist threshold.</p>
              ) : (
                result.rankedShortlist.map((c, rank) => (
                  <CandidateCard key={c.id} candidate={c} rank={rank + 1} />
                ))
              )}
            </TabsContent>

            <TabsContent value="maybes" className="space-y-4 mt-4">
              {result.maybes.length === 0 ? (
                <p className="text-muted-foreground text-sm">No maybe candidates.</p>
              ) : (
                result.maybes.map((c, rank) => (
                  <CandidateCard key={c.id} candidate={c} rank={result.rankedShortlist.length + rank + 1} />
                ))
              )}
            </TabsContent>

            <TabsContent value="dnc" className="space-y-4 mt-4">
              {result.doNotContact.length === 0 ? (
                <p className="text-muted-foreground text-sm">No candidates flagged.</p>
              ) : (
                result.doNotContact.map((c) => (
                  <Card key={c.id} className="border-destructive/30">
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium">{c.id}</span> — {c.name}
                        </div>
                        <Badge variant="destructive">Do Not Contact</Badge>
                      </div>
                      <p className="text-sm text-destructive mt-1">{c.reason}</p>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            <TabsContent value="outreach" className="space-y-6 mt-4">
              {result.outreachDrafts.length === 0 ? (
                <p className="text-muted-foreground text-sm">No outreach drafts generated.</p>
              ) : (
                result.outreachDrafts.map((draft) => (
                  <OutreachCard key={draft.candidateId} draft={draft} />
                ))
              )}
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function CandidateCard({ candidate, rank }: { candidate: EvaluatedCandidate; rank: number }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card>
      <CardContent className="py-4 space-y-3">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl font-bold text-muted-foreground">#{rank}</span>
            <div>
              <div className="font-medium">
                {candidate.id} — {candidate.name}
              </div>
              {candidate.extractedFacts?.currentRole && (
                <div className="text-sm text-muted-foreground">{candidate.extractedFacts.currentRole}</div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold">{candidate.totalScore}</span>
            <span className="text-sm text-muted-foreground">/100</span>
            <Badge variant={confidenceBadgeVariant(candidate.confidence)}>{candidate.confidence}</Badge>
          </div>
        </div>

        {/* Score bar */}
        <Progress value={candidate.totalScore} className="h-2" />

        {/* Hook lines */}
        <div>
          <span className="text-xs font-medium uppercase text-muted-foreground">Why reach out</span>
          <ul className="text-sm mt-1 space-y-0.5">
            {candidate.hookLines.map((h, i) => (
              <li key={i}>+ {h}</li>
            ))}
          </ul>
        </div>

        {/* Concerns */}
        <div>
          <span className="text-xs font-medium uppercase text-muted-foreground">Concerns / Unknowns</span>
          <ul className="text-sm mt-1 space-y-0.5">
            {candidate.concerns.map((c, i) => (
              <li key={i} className="text-yellow-600">? {c}</li>
            ))}
          </ul>
        </div>

        {/* Suggested angle */}
        <div>
          <span className="text-xs font-medium uppercase text-muted-foreground">Suggested angle</span>
          <p className="text-sm mt-1">{candidate.suggestedAngle}</p>
        </div>

        {/* Expand/collapse detail */}
        <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)}>
          {expanded ? "Hide score breakdown" : "Show score breakdown"}
        </Button>

        {expanded && (
          <div className="space-y-2 border-t pt-3">
            {Object.entries(candidate.breakdown).map(([key, cat]) => (
              <div key={key} className="grid grid-cols-[200px_80px_1fr] gap-2 text-sm items-start">
                <span className="font-medium">{formatRubricKey(key)}</span>
                <span>
                  {cat.score}/{cat.maxScore}
                </span>
                <span className="text-muted-foreground">{cat.justification}</span>
              </div>
            ))}

            {candidate.extractedFacts && (
              <div className="border-t pt-2 mt-2">
                <span className="text-xs font-medium uppercase text-muted-foreground">Extracted facts</span>
                <div className="text-sm mt-1 space-y-0.5">
                  {candidate.extractedFacts.yearsExperience && (
                    <div>Experience: {candidate.extractedFacts.yearsExperience}</div>
                  )}
                  {candidate.extractedFacts.location && (
                    <div>Location: {candidate.extractedFacts.location}</div>
                  )}
                  {candidate.extractedFacts.relevantSkills && candidate.extractedFacts.relevantSkills.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {candidate.extractedFacts.relevantSkills.map((s) => (
                        <Badge key={s} variant="outline" className="text-xs">
                          {s}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function OutreachCard({ draft }: { draft: OutreachDrafts }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {draft.candidateId} — {draft.candidateName}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-xs uppercase text-muted-foreground">Short Draft #1</Label>
            <div className="rounded-md bg-muted p-3 text-sm whitespace-pre-wrap">{draft.shortDraft1}</div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs uppercase text-muted-foreground">Short Draft #2</Label>
            <div className="rounded-md bg-muted p-3 text-sm whitespace-pre-wrap">{draft.shortDraft2}</div>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-xs uppercase text-muted-foreground">Medium Draft #1</Label>
            <div className="rounded-md bg-muted p-3 text-sm whitespace-pre-wrap">{draft.mediumDraft1}</div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs uppercase text-muted-foreground">Medium Draft #2</Label>
            <div className="rounded-md bg-muted p-3 text-sm whitespace-pre-wrap">{draft.mediumDraft2}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Utils ───────────────────────────────────────────────────────────────────

function formatRubricKey(key: string): string {
  const map: Record<string, string> = {
    coreMustHavesFit: "Core Must-Haves Fit",
    relevantScopeSeniority: "Scope / Seniority",
    domainIndustryRelevance: "Domain Relevance",
    evidenceImpactMetrics: "Evidence & Impact",
    stabilityTrajectory: "Stability & Trajectory",
    locationWorkModelAlignment: "Location / Work Model",
    bonusSignals: "Bonus Signals",
  };
  return map[key] || key;
}
