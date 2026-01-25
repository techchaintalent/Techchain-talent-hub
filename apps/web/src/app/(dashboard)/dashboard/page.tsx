import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@techchain/lib";
import { prisma, UserRole, RecruiterStatus } from "@techchain/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import Link from "next/link";
import { Button } from "@/components/ui/button";

async function getRecruiterDashboard(userId: string) {
  const recruiter = await prisma.recruiterProfile.findUnique({
    where: { userId },
    include: {
      _count: {
        select: { submissions: true, commissions: true, roleAccesses: true },
      },
    },
  });

  if (!recruiter) {
    return { needsOnboarding: true };
  }

  if (recruiter.status === RecruiterStatus.PENDING_ONBOARDING) {
    return { recruiter, needsOnboarding: true };
  }

  if (recruiter.status === RecruiterStatus.PENDING_APPROVAL) {
    return { recruiter, pendingApproval: true };
  }

  if (recruiter.status === RecruiterStatus.REJECTED) {
    return { recruiter, rejected: true };
  }

  // Get stats for approved recruiters
  const [submissions, pendingPayouts] = await Promise.all([
    prisma.candidateSubmission.findMany({
      where: { recruiterId: recruiter.id },
      take: 5,
      orderBy: { createdAt: "desc" },
      include: {
        role: {
          select: { title: true, company: { select: { name: true } } },
        },
      },
    }),
    prisma.commission.aggregate({
      where: {
        recruiterId: recruiter.id,
        status: { in: ["PAYOUT_PENDING", "PAYOUT_PROCESSING"] },
      },
      _sum: { netAmount: true },
    }),
  ]);

  return {
    recruiter,
    approved: true,
    stats: {
      totalSubmissions: recruiter._count.submissions,
      activeRoles: recruiter._count.roleAccesses,
      pendingPayouts: pendingPayouts._sum.netAmount || 0,
    },
    recentSubmissions: submissions,
  };
}

async function getCandidateDashboard(userId: string) {
  const profile = await prisma.candidateProfile.findUnique({
    where: { userId },
    include: {
      cryptoScores: { orderBy: { createdAt: "desc" }, take: 1 },
      techScores: { orderBy: { createdAt: "desc" }, take: 1 },
      employabilityPlans: { orderBy: { createdAt: "desc" }, take: 1 },
      roleFitAssessments: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!profile) {
    return { needsOnboarding: true };
  }

  return { profile };
}

async function getAdminDashboard() {
  const [
    pendingRecruiters,
    totalRoles,
    totalSubmissions,
    totalCandidates,
  ] = await Promise.all([
    prisma.recruiterProfile.count({ where: { status: RecruiterStatus.PENDING_APPROVAL } }),
    prisma.role.count({ where: { status: "LIVE" } }),
    prisma.candidateSubmission.count(),
    prisma.candidateProfile.count({ where: { status: "ACTIVE" } }),
  ]);

  return {
    stats: {
      pendingRecruiters,
      totalRoles,
      totalSubmissions,
      totalCandidates,
    },
  };
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/auth/signin");
  }

  const { role } = session.user;

  // Recruiter Dashboard
  if (role === UserRole.RECRUITER) {
    const data = await getRecruiterDashboard(session.user.id);

    if (data.needsOnboarding) {
      return (
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Complete Your Profile</CardTitle>
              <CardDescription>
                Before you can access the marketplace, please complete your recruiter profile.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/recruiter/onboarding">
                <Button>Start Onboarding</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      );
    }

    if (data.pendingApproval) {
      return (
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Badge variant="warning">Pending Approval</Badge>
              </CardTitle>
              <CardDescription>
                Your recruiter application is being reviewed by our team.
                You'll receive an email once your account is approved.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                In the meantime, make sure your profile is complete and accurate.
              </p>
              <Link href="/recruiter/profile" className="mt-4 inline-block">
                <Button variant="outline">View Profile</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      );
    }

    if (data.rejected) {
      return (
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Badge variant="destructive">Application Not Approved</Badge>
              </CardTitle>
              <CardDescription>
                Unfortunately, your recruiter application was not approved at this time.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                {data.recruiter?.rejectionReason || "Please contact support for more information."}
              </p>
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold">Welcome back, {data.recruiter?.fullName || "Recruiter"}</h1>
          <p className="text-muted-foreground">Here's an overview of your recruiting activity</p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Submissions</CardDescription>
              <CardTitle className="text-3xl">{data.stats?.totalSubmissions || 0}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Active Roles</CardDescription>
              <CardTitle className="text-3xl">{data.stats?.activeRoles || 0}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Pending Payouts</CardDescription>
              <CardTitle className="text-3xl">
                ${(data.stats?.pendingPayouts || 0).toLocaleString()}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Recent Submissions</CardTitle>
            </CardHeader>
            <CardContent>
              {data.recentSubmissions?.length ? (
                <div className="space-y-4">
                  {data.recentSubmissions.map((sub) => (
                    <div key={sub.id} className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{sub.candidateName}</p>
                        <p className="text-sm text-muted-foreground">
                          {sub.role.title} at {sub.role.company.name}
                        </p>
                      </div>
                      <Badge>{sub.status}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No submissions yet</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link href="/recruiter/marketplace" className="block">
                <Button className="w-full" variant="outline">Browse Marketplace</Button>
              </Link>
              <Link href="/recruiter/submissions" className="block">
                <Button className="w-full" variant="outline">View Submissions</Button>
              </Link>
              <Link href="/recruiter/commissions" className="block">
                <Button className="w-full" variant="outline">View Commissions</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Candidate Dashboard
  if (role === UserRole.CANDIDATE) {
    const data = await getCandidateDashboard(session.user.id);

    if (data.needsOnboarding) {
      return (
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Welcome to TechChain Talent Hub</CardTitle>
              <CardDescription>
                Complete your profile to get your personalized crypto career assessment.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/candidate/onboarding">
                <Button>Get Started</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      );
    }

    const { profile } = data;
    const cryptoScore = profile?.cryptoScores[0];
    const techScore = profile?.techScores[0];
    const plan = profile?.employabilityPlans[0];

    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold">Welcome, {profile?.fullName || "Candidate"}</h1>
          <p className="text-muted-foreground">Your crypto career dashboard</p>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Profile Completeness</CardDescription>
              <CardTitle className="text-3xl">{profile?.completenessScore || 0}%</CardTitle>
            </CardHeader>
            <CardContent>
              <Progress value={profile?.completenessScore || 0} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Crypto Native Score</CardDescription>
              <CardTitle className="text-3xl">
                {cryptoScore?.cryptoNativeScore ?? "—"}/100
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Tech Score</CardDescription>
              <CardTitle className="text-3xl">
                {techScore?.overallScore ?? "—"}/100
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Target Roles</CardDescription>
              <CardTitle className="text-3xl">
                {profile?.desiredRoleTitles.length || 0}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        {cryptoScore && (
          <Card>
            <CardHeader>
              <CardTitle>Crypto Native Assessment</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground whitespace-pre-wrap">
                {cryptoScore.rationale}
              </p>
            </CardContent>
          </Card>
        )}

        {plan && (
          <Card>
            <CardHeader>
              <CardTitle>Your Employability Plan</CardTitle>
              <CardDescription>{(plan.planJson as any).headlineSummary}</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/candidate/assessments">
                <Button>View Full Plan</Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {!cryptoScore && (
          <Card>
            <CardHeader>
              <CardTitle>Get Your Assessment</CardTitle>
              <CardDescription>
                Run your first assessment to get your Crypto Native Score and personalized career plan.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/candidate/assessments">
                <Button>Run Assessment</Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // Admin Dashboard
  if (role === UserRole.PLATFORM_ADMIN) {
    const data = await getAdminDashboard();

    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground">Platform overview and management</p>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Pending Recruiters</CardDescription>
              <CardTitle className="text-3xl">{data.stats.pendingRecruiters}</CardTitle>
            </CardHeader>
            <CardContent>
              <Link href="/admin/recruiters?status=PENDING_APPROVAL">
                <Button variant="link" className="p-0 h-auto">Review →</Button>
              </Link>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Live Roles</CardDescription>
              <CardTitle className="text-3xl">{data.stats.totalRoles}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Submissions</CardDescription>
              <CardTitle className="text-3xl">{data.stats.totalSubmissions}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Community Candidates</CardDescription>
              <CardTitle className="text-3xl">{data.stats.totalCandidates}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link href="/admin/recruiters" className="block">
                <Button className="w-full" variant="outline">Manage Recruiters</Button>
              </Link>
              <Link href="/admin/companies" className="block">
                <Button className="w-full" variant="outline">Manage Companies</Button>
              </Link>
              <Link href="/admin/candidates" className="block">
                <Button className="w-full" variant="outline">View Candidates</Button>
              </Link>
              <Link href="/admin/config" className="block">
                <Button className="w-full" variant="outline">Platform Config</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Company Dashboard (default for company roles)
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Company Dashboard</h1>
        <p className="text-muted-foreground">Manage your roles and candidates</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link href="/company/roles" className="block">
              <Button className="w-full" variant="outline">Manage Roles</Button>
            </Link>
            <Link href="/company/candidates" className="block">
              <Button className="w-full" variant="outline">View Candidates</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
