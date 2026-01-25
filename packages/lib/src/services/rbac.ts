import { prisma, UserRole, RecruiterStatus } from "@techchain/db";

export type Permission =
  // Platform Admin
  | "admin:all"
  | "admin:approve_recruiters"
  | "admin:manage_companies"
  | "admin:view_all_candidates"
  | "admin:manage_platform_config"
  | "admin:view_fraud_dashboard"
  | "admin:manage_take_rates"

  // Recruiter
  | "recruiter:view_marketplace"
  | "recruiter:request_role_access"
  | "recruiter:submit_candidates"
  | "recruiter:view_own_submissions"
  | "recruiter:view_commissions"
  | "recruiter:manage_profile"
  | "recruiter:search_candidates"

  // Company
  | "company:manage_roles"
  | "company:view_submissions"
  | "company:update_submission_status"
  | "company:manage_billing"
  | "company:invite_members"

  // Candidate
  | "candidate:manage_profile"
  | "candidate:view_assessments"
  | "candidate:run_assessments"
  | "candidate:manage_privacy";

const rolePermissions: Record<UserRole, Permission[]> = {
  [UserRole.PLATFORM_ADMIN]: [
    "admin:all",
    "admin:approve_recruiters",
    "admin:manage_companies",
    "admin:view_all_candidates",
    "admin:manage_platform_config",
    "admin:view_fraud_dashboard",
    "admin:manage_take_rates",
    "recruiter:view_marketplace",
    "recruiter:search_candidates",
  ],
  [UserRole.RECRUITER]: [
    "recruiter:manage_profile",
    "recruiter:view_own_submissions",
    "recruiter:view_commissions",
  ],
  [UserRole.COMPANY_ADMIN]: [
    "company:manage_roles",
    "company:view_submissions",
    "company:update_submission_status",
    "company:manage_billing",
    "company:invite_members",
  ],
  [UserRole.COMPANY_USER]: [
    "company:view_submissions",
    "company:update_submission_status",
  ],
  [UserRole.CANDIDATE]: [
    "candidate:manage_profile",
    "candidate:view_assessments",
    "candidate:run_assessments",
    "candidate:manage_privacy",
  ],
};

// Additional permissions for approved recruiters
const approvedRecruiterPermissions: Permission[] = [
  "recruiter:view_marketplace",
  "recruiter:request_role_access",
  "recruiter:submit_candidates",
  "recruiter:search_candidates",
];

export interface AuthContext {
  userId: string;
  role: UserRole;
  recruiterStatus?: RecruiterStatus;
  companyId?: string;
}

export function hasPermission(ctx: AuthContext, permission: Permission): boolean {
  // Platform admin has all permissions
  if (ctx.role === UserRole.PLATFORM_ADMIN) {
    return true;
  }

  const basePermissions = rolePermissions[ctx.role] || [];

  // Check base permissions
  if (basePermissions.includes(permission)) {
    return true;
  }

  // Check approved recruiter permissions
  if (
    ctx.role === UserRole.RECRUITER &&
    ctx.recruiterStatus === RecruiterStatus.APPROVED &&
    approvedRecruiterPermissions.includes(permission)
  ) {
    return true;
  }

  return false;
}

export function requirePermission(ctx: AuthContext, permission: Permission): void {
  if (!hasPermission(ctx, permission)) {
    throw new PermissionError(permission);
  }
}

export class PermissionError extends Error {
  constructor(permission: Permission) {
    super(`Missing permission: ${permission}`);
    this.name = "PermissionError";
  }
}

export async function getAuthContext(userId: string): Promise<AuthContext> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      recruiterProfile: true,
      companyMembership: true,
    },
  });

  if (!user) {
    throw new Error("User not found");
  }

  return {
    userId: user.id,
    role: user.role,
    recruiterStatus: user.recruiterProfile?.status,
    companyId: user.companyMembership?.companyId,
  };
}

export function isApprovedRecruiter(ctx: AuthContext): boolean {
  return (
    ctx.role === UserRole.RECRUITER &&
    ctx.recruiterStatus === RecruiterStatus.APPROVED
  );
}

export function canAccessRole(
  ctx: AuthContext,
  roleAccessModel: string,
  hasAccess: boolean
): boolean {
  // Platform admin can always access
  if (ctx.role === UserRole.PLATFORM_ADMIN) {
    return true;
  }

  // Must be approved recruiter
  if (!isApprovedRecruiter(ctx)) {
    return false;
  }

  // Check access model
  switch (roleAccessModel) {
    case "OPEN":
      return true;
    case "REQUEST":
    case "INVITE_ONLY":
      return hasAccess;
    default:
      return false;
  }
}
