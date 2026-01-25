import Stripe from "stripe";
import { prisma, CommissionStatus, Prisma } from "@techchain/db";
import { env, isDevMode } from "../env";

let stripe: Stripe | null = null;

function getStripe(): Stripe {
  if (!stripe) {
    if (!env.STRIPE_SECRET_KEY && !isDevMode()) {
      throw new Error("STRIPE_SECRET_KEY is required in production mode");
    }
    stripe = new Stripe(env.STRIPE_SECRET_KEY || "sk_test_placeholder", {
      apiVersion: "2024-04-10",
    });
  }
  return stripe;
}

// Commission state machine transitions
const VALID_TRANSITIONS: Record<CommissionStatus, CommissionStatus[]> = {
  [CommissionStatus.PENDING_HIRE]: [CommissionStatus.PENDING_START, CommissionStatus.CANCELLED],
  [CommissionStatus.PENDING_START]: [CommissionStatus.PENDING_PAYMENT, CommissionStatus.CANCELLED],
  [CommissionStatus.PENDING_PAYMENT]: [CommissionStatus.PAYMENT_SCHEDULED, CommissionStatus.CANCELLED, CommissionStatus.DISPUTED],
  [CommissionStatus.PAYMENT_SCHEDULED]: [CommissionStatus.PAYMENT_COLLECTED, CommissionStatus.CANCELLED, CommissionStatus.DISPUTED],
  [CommissionStatus.PAYMENT_COLLECTED]: [CommissionStatus.PAYOUT_PENDING, CommissionStatus.DISPUTED],
  [CommissionStatus.PAYOUT_PENDING]: [CommissionStatus.PAYOUT_PROCESSING, CommissionStatus.DISPUTED],
  [CommissionStatus.PAYOUT_PROCESSING]: [CommissionStatus.PAYOUT_COMPLETED, CommissionStatus.DISPUTED],
  [CommissionStatus.PAYOUT_COMPLETED]: [CommissionStatus.DISPUTED],
  [CommissionStatus.CANCELLED]: [],
  [CommissionStatus.DISPUTED]: [CommissionStatus.PAYOUT_PENDING, CommissionStatus.CANCELLED],
};

export function canTransition(from: CommissionStatus, to: CommissionStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export interface TransitionCommissionParams {
  commissionId: string;
  newStatus: CommissionStatus;
  metadata?: Record<string, any>;
}

export async function transitionCommissionStatus(
  params: TransitionCommissionParams
): Promise<void> {
  const { commissionId, newStatus, metadata } = params;

  // Use transaction for atomic update
  await prisma.$transaction(async (tx) => {
    const commission = await tx.commission.findUnique({
      where: { id: commissionId },
      select: { id: true, status: true, statusHistory: true, idempotencyKey: true },
    });

    if (!commission) {
      throw new Error(`Commission not found: ${commissionId}`);
    }

    // Validate transition
    if (!canTransition(commission.status, newStatus)) {
      throw new Error(
        `Invalid transition from ${commission.status} to ${newStatus}`
      );
    }

    // Build status history
    const history = (commission.statusHistory as any[]) || [];
    history.push({
      from: commission.status,
      to: newStatus,
      timestamp: new Date().toISOString(),
      ...metadata,
    });

    // Update commission
    await tx.commission.update({
      where: { id: commissionId },
      data: {
        status: newStatus,
        statusHistory: history,
        ...(newStatus === CommissionStatus.PAYMENT_COLLECTED && {
          paymentCollectedAt: new Date(),
        }),
        ...(newStatus === CommissionStatus.PAYOUT_PROCESSING && {
          payoutInitiatedAt: new Date(),
        }),
        ...(newStatus === CommissionStatus.PAYOUT_COMPLETED && {
          payoutCompletedAt: new Date(),
        }),
      },
    });
  });
}

export interface CreateCommissionParams {
  submissionId: string;
  recruiterId: string;
  grossAmount: number;
  takeRate: number;
  currency?: string;
}

export async function createCommission(
  params: CreateCommissionParams
): Promise<string> {
  const { submissionId, recruiterId, grossAmount, takeRate, currency = "USD" } = params;

  const platformFee = grossAmount * (takeRate / 100);
  const netAmount = grossAmount - platformFee;

  const commission = await prisma.commission.create({
    data: {
      submissionId,
      recruiterId,
      grossAmount,
      platformFee,
      netAmount,
      takeRateApplied: takeRate,
      currency,
      status: CommissionStatus.PENDING_HIRE,
      statusHistory: [
        {
          status: CommissionStatus.PENDING_HIRE,
          timestamp: new Date().toISOString(),
        },
      ],
    },
  });

  return commission.id;
}

export async function calculateTakeRate(
  companyId: string,
  roleId: string
): Promise<number> {
  // Check for role-specific override
  const role = await prisma.role.findUnique({
    where: { id: roleId },
    select: { takeRateOverride: true },
  });

  if (role?.takeRateOverride !== null && role?.takeRateOverride !== undefined) {
    return role.takeRateOverride;
  }

  // Check for company-specific override
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { takeRateOverride: true },
  });

  if (company?.takeRateOverride !== null && company?.takeRateOverride !== undefined) {
    return company.takeRateOverride;
  }

  // Fall back to platform default
  const config = await prisma.platformConfig.findUnique({
    where: { key: "default_take_rate" },
  });

  return config ? parseFloat(config.value) : env.DEFAULT_TAKE_RATE;
}

export async function schedulePaymentCollection(
  commissionId: string,
  startDate: Date
): Promise<void> {
  const paymentDelayDays = await getPaymentDelayDays();
  const paymentDueDate = new Date(startDate);
  paymentDueDate.setDate(paymentDueDate.getDate() + paymentDelayDays);

  await prisma.commission.update({
    where: { id: commissionId },
    data: { paymentDueDate },
  });

  await transitionCommissionStatus({
    commissionId,
    newStatus: CommissionStatus.PAYMENT_SCHEDULED,
    metadata: { paymentDueDate: paymentDueDate.toISOString() },
  });
}

async function getPaymentDelayDays(): Promise<number> {
  const config = await prisma.platformConfig.findUnique({
    where: { key: "payment_delay_days" },
  });

  return config ? parseInt(config.value) : env.PAYMENT_DELAY_DAYS;
}

// Stripe Integration Functions

export async function createCustomer(
  companyId: string,
  email: string,
  name: string
): Promise<string> {
  if (isDevMode()) {
    const mockId = `cus_mock_${Date.now()}`;
    await prisma.company.update({
      where: { id: companyId },
      data: { stripeCustomerId: mockId },
    });
    return mockId;
  }

  const client = getStripe();
  const customer = await client.customers.create({
    email,
    name,
    metadata: { companyId },
  });

  await prisma.company.update({
    where: { id: companyId },
    data: { stripeCustomerId: customer.id },
  });

  return customer.id;
}

export async function createConnectAccount(
  recruiterId: string,
  email: string
): Promise<string> {
  if (isDevMode()) {
    const mockId = `acct_mock_${Date.now()}`;
    await prisma.recruiterProfile.update({
      where: { id: recruiterId },
      data: { stripeConnectId: mockId },
    });
    return mockId;
  }

  const client = getStripe();
  const account = await client.accounts.create({
    type: "express",
    email,
    metadata: { recruiterId },
    capabilities: {
      transfers: { requested: true },
    },
  });

  await prisma.recruiterProfile.update({
    where: { id: recruiterId },
    data: { stripeConnectId: account.id },
  });

  return account.id;
}

export async function createConnectOnboardingLink(
  accountId: string,
  returnUrl: string,
  refreshUrl: string
): Promise<string> {
  if (isDevMode()) {
    return `${returnUrl}?mock_onboarding=true`;
  }

  const client = getStripe();
  const accountLink = await client.accountLinks.create({
    account: accountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: "account_onboarding",
  });

  return accountLink.url;
}

export async function collectPayment(
  commissionId: string
): Promise<{ success: boolean; error?: string }> {
  const commission = await prisma.commission.findUnique({
    where: { id: commissionId },
    include: {
      submission: {
        include: {
          role: {
            include: { company: true },
          },
        },
      },
    },
  });

  if (!commission) {
    return { success: false, error: "Commission not found" };
  }

  const company = commission.submission.role.company;

  if (!company.stripeCustomerId && !isDevMode()) {
    return { success: false, error: "Company has no payment method" };
  }

  if (isDevMode()) {
    // Simulate payment collection in dev mode
    const mockPaymentIntentId = `pi_mock_${Date.now()}`;

    await prisma.commission.update({
      where: { id: commissionId },
      data: { stripePaymentIntentId: mockPaymentIntentId },
    });

    await transitionCommissionStatus({
      commissionId,
      newStatus: CommissionStatus.PAYMENT_COLLECTED,
      metadata: { stripePaymentIntentId: mockPaymentIntentId },
    });

    return { success: true };
  }

  try {
    const client = getStripe();

    const paymentIntent = await client.paymentIntents.create({
      amount: Math.round(commission.grossAmount * 100), // Convert to cents
      currency: commission.currency.toLowerCase(),
      customer: company.stripeCustomerId!,
      off_session: true,
      confirm: true,
      metadata: {
        commissionId: commission.id,
        submissionId: commission.submissionId,
        companyId: company.id,
      },
    }, {
      idempotencyKey: `collect_${commission.idempotencyKey}`,
    });

    await prisma.commission.update({
      where: { id: commissionId },
      data: { stripePaymentIntentId: paymentIntent.id },
    });

    if (paymentIntent.status === "succeeded") {
      await transitionCommissionStatus({
        commissionId,
        newStatus: CommissionStatus.PAYMENT_COLLECTED,
        metadata: { stripePaymentIntentId: paymentIntent.id },
      });
      return { success: true };
    }

    return { success: false, error: `Payment status: ${paymentIntent.status}` };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function initiatePayout(
  commissionId: string
): Promise<{ success: boolean; error?: string }> {
  const commission = await prisma.commission.findUnique({
    where: { id: commissionId },
    include: {
      recruiter: true,
    },
  });

  if (!commission) {
    return { success: false, error: "Commission not found" };
  }

  if (!commission.recruiter.stripeConnectId && !isDevMode()) {
    return { success: false, error: "Recruiter has no payout account" };
  }

  await transitionCommissionStatus({
    commissionId,
    newStatus: CommissionStatus.PAYOUT_PROCESSING,
  });

  if (isDevMode()) {
    // Simulate payout in dev mode
    const mockTransferId = `tr_mock_${Date.now()}`;

    await prisma.commission.update({
      where: { id: commissionId },
      data: { stripeTransferId: mockTransferId },
    });

    await transitionCommissionStatus({
      commissionId,
      newStatus: CommissionStatus.PAYOUT_COMPLETED,
      metadata: { stripeTransferId: mockTransferId },
    });

    return { success: true };
  }

  try {
    const client = getStripe();

    const transfer = await client.transfers.create({
      amount: Math.round(commission.netAmount * 100),
      currency: commission.currency.toLowerCase(),
      destination: commission.recruiter.stripeConnectId!,
      metadata: {
        commissionId: commission.id,
        recruiterId: commission.recruiterId,
      },
    }, {
      idempotencyKey: `payout_${commission.idempotencyKey}`,
    });

    await prisma.commission.update({
      where: { id: commissionId },
      data: { stripeTransferId: transfer.id },
    });

    await transitionCommissionStatus({
      commissionId,
      newStatus: CommissionStatus.PAYOUT_COMPLETED,
      metadata: { stripeTransferId: transfer.id },
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getDuePayments(): Promise<string[]> {
  const now = new Date();

  const commissions = await prisma.commission.findMany({
    where: {
      status: CommissionStatus.PAYMENT_SCHEDULED,
      paymentDueDate: { lte: now },
    },
    select: { id: true },
  });

  return commissions.map((c) => c.id);
}

export async function getReadyForPayout(): Promise<string[]> {
  const commissions = await prisma.commission.findMany({
    where: {
      status: CommissionStatus.PAYOUT_PENDING,
    },
    select: { id: true },
  });

  return commissions.map((c) => c.id);
}

// Move to payout pending after payment collected
export async function markReadyForPayout(commissionId: string): Promise<void> {
  await transitionCommissionStatus({
    commissionId,
    newStatus: CommissionStatus.PAYOUT_PENDING,
  });
}
