"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DashboardNavProps {
  user: {
    id: string;
    email: string;
    name?: string | null;
    role: string;
  };
}

export function DashboardNav({ user }: DashboardNavProps) {
  const pathname = usePathname();

  const getNavItems = () => {
    switch (user.role) {
      case "PLATFORM_ADMIN":
        return [
          { href: "/dashboard", label: "Overview" },
          { href: "/admin/recruiters", label: "Recruiters" },
          { href: "/admin/companies", label: "Companies" },
          { href: "/admin/candidates", label: "Candidates" },
          { href: "/admin/roles", label: "Roles" },
          { href: "/admin/config", label: "Config" },
        ];
      case "RECRUITER":
        return [
          { href: "/dashboard", label: "Overview" },
          { href: "/recruiter/marketplace", label: "Marketplace" },
          { href: "/recruiter/evaluate", label: "Evaluate" },
          { href: "/recruiter/submissions", label: "Submissions" },
          { href: "/recruiter/commissions", label: "Commissions" },
          { href: "/recruiter/profile", label: "Profile" },
        ];
      case "COMPANY_ADMIN":
      case "COMPANY_USER":
        return [
          { href: "/dashboard", label: "Overview" },
          { href: "/company/roles", label: "Roles" },
          { href: "/company/candidates", label: "Candidates" },
          { href: "/company/billing", label: "Billing" },
          { href: "/company/settings", label: "Settings" },
        ];
      case "CANDIDATE":
      default:
        return [
          { href: "/dashboard", label: "Overview" },
          { href: "/candidate/profile", label: "Profile" },
          { href: "/candidate/assessments", label: "Assessments" },
          { href: "/candidate/privacy", label: "Privacy" },
        ];
    }
  };

  const navItems = getNavItems();

  return (
    <header className="border-b bg-white sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">TC</span>
              </div>
              <span className="font-semibold hidden sm:inline">TechChain</span>
            </Link>

            <nav className="flex items-center gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "px-3 py-2 text-sm font-medium rounded-md transition-colors",
                    pathname === item.href
                      ? "bg-indigo-50 text-indigo-700"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-sm text-muted-foreground hidden sm:block">
              {user.email}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => signOut({ callbackUrl: "/" })}
            >
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
