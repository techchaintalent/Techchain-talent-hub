import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@techchain/lib";
import { prisma, RoleStatus, UserRole, RecruiterStatus } from "@techchain/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";

async function getRoles(recruiterId: string) {
  const roles = await prisma.role.findMany({
    where: { status: RoleStatus.LIVE },
    include: {
      company: {
        select: { id: true, name: true, logoUrl: true },
      },
      _count: {
        select: { submissions: true },
      },
    },
    orderBy: { publishedAt: "desc" },
  });

  // Get recruiter's access status for each role
  const accesses = await prisma.roleAccess.findMany({
    where: {
      recruiterId,
      roleId: { in: roles.map((r) => r.id) },
    },
  });

  const accessMap = new Map(accesses.map((a) => [a.roleId, a.status]));

  return roles.map((role) => ({
    ...role,
    myAccessStatus: accessMap.get(role.id) || null,
    hasAccess:
      role.accessModel === "OPEN" || accessMap.get(role.id) === "APPROVED",
  }));
}

export default async function MarketplacePage() {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== UserRole.RECRUITER) {
    redirect("/dashboard");
  }

  // Check if recruiter is approved
  const recruiter = await prisma.recruiterProfile.findUnique({
    where: { userId: session.user.id },
  });

  if (!recruiter || recruiter.status !== RecruiterStatus.APPROVED) {
    redirect("/dashboard");
  }

  const roles = await getRoles(recruiter.id);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Role Marketplace</h1>
        <p className="text-muted-foreground">
          Browse and request access to live roles
        </p>
      </div>

      {roles.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              No live roles available at the moment. Check back soon!
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {roles.map((role) => (
            <Card key={role.id} className="flex flex-col">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{role.title}</CardTitle>
                    <CardDescription>{role.company.name}</CardDescription>
                  </div>
                  <Badge
                    variant={
                      role.hasAccess
                        ? "success"
                        : role.myAccessStatus === "PENDING"
                          ? "warning"
                          : "secondary"
                    }
                  >
                    {role.hasAccess
                      ? "Access Granted"
                      : role.myAccessStatus === "PENDING"
                        ? "Pending"
                        : role.accessModel === "OPEN"
                          ? "Open"
                          : "Request Access"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex-1 space-y-4">
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {role.description}
                </p>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Location</span>
                    <span>{role.location} ({role.locationType})</span>
                  </div>
                  {role.salaryMin && role.salaryMax && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Salary</span>
                      <span>
                        ${role.salaryMin.toLocaleString()} - ${role.salaryMax.toLocaleString()}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Commission</span>
                    <span>
                      {role.commissionType === "PERCENTAGE"
                        ? `${role.commissionValue}%`
                        : `$${role.commissionValue.toLocaleString()}`}
                    </span>
                  </div>
                </div>

                {role.cryptoTags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {role.cryptoTags.map((tag) => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}

                <div className="pt-4 border-t">
                  <Link href={`/recruiter/roles/${role.id}`}>
                    <Button
                      className="w-full"
                      variant={role.hasAccess ? "default" : "outline"}
                    >
                      {role.hasAccess ? "View & Submit" : "View Details"}
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
