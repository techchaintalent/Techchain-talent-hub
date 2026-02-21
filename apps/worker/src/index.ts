import { Worker, Job } from "bullmq";
import IORedis from "ioredis";
import {
  AssessmentJobData,
  PaymentJobData,
  EmailJobData,
  RecommenderJobData,
  runCandidateAssessment,
  executeAssessmentRun,
  scoreSubmission,
  collectPayment,
  initiatePayout,
  getDuePayments,
  getReadyForPayout,
  markReadyForPayout,
  sendEmail,
  sendRecruiterApprovalEmail,
  sendSubmissionStatusEmail,
  sendPaymentNotificationEmail,
  sendCandidateAssessmentCompleteEmail,
  findHiddenTalentForRole,
  env,
  isDevMode,
} from "@techchain/lib";
import { QUEUE_NAMES } from "@techchain/lib/src/queue";
import { prisma } from "@techchain/db";

console.log("🚀 Starting TechChain Worker...");
console.log(`📍 Environment: ${process.env.NODE_ENV || "development"}`);
console.log(`🧪 Dev Mode: ${isDevMode()}`);

// Redis connection
const connection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

// Assessments Worker
const assessmentsWorker = new Worker<AssessmentJobData>(
  QUEUE_NAMES.ASSESSMENTS,
  async (job: Job<AssessmentJobData>) => {
    console.log(`[Assessments] Processing job ${job.id}: ${job.data.type}`);

    try {
      if (job.data.type === "candidate_assessment" && job.data.candidateId) {
        await runCandidateAssessment({
          candidateId: job.data.candidateId,
          triggeredBy: job.data.triggeredBy as "candidate" | "admin" | "system",
          assessmentTypes: job.data.assessmentTypes,
        });

        // Send completion email
        const profile = await prisma.candidateProfile.findUnique({
          where: { id: job.data.candidateId },
          include: { user: true },
        });

        if (profile) {
          await sendCandidateAssessmentCompleteEmail(
            profile.user.email,
            profile.fullName || profile.user.name || "Candidate"
          );
        }
      } else if (job.data.type === "submission_scoring" && job.data.submissionId) {
        await scoreSubmission({ submissionId: job.data.submissionId });
      }

      console.log(`[Assessments] Job ${job.id} completed`);
    } catch (error) {
      console.error(`[Assessments] Job ${job.id} failed:`, error);
      throw error;
    }
  },
  { connection, concurrency: 2 }
);

// Payments Worker
const paymentsWorker = new Worker<PaymentJobData>(
  QUEUE_NAMES.PAYMENTS,
  async (job: Job<PaymentJobData>) => {
    console.log(`[Payments] Processing job ${job.id}: ${job.data.type}`);

    try {
      if (job.data.type === "collect_payment" && job.data.commissionId) {
        const result = await collectPayment(job.data.commissionId);

        if (result.success) {
          // Mark as ready for payout
          await markReadyForPayout(job.data.commissionId);
        } else {
          console.error(`[Payments] Collection failed: ${result.error}`);
        }
      } else if (job.data.type === "initiate_payout" && job.data.commissionId) {
        const result = await initiatePayout(job.data.commissionId);

        if (!result.success) {
          console.error(`[Payments] Payout failed: ${result.error}`);
        }
      } else if (job.data.type === "check_due_payments") {
        // Find all due payments
        const dueCommissions = await getDuePayments();
        console.log(`[Payments] Found ${dueCommissions.length} due payments`);

        for (const commissionId of dueCommissions) {
          const result = await collectPayment(commissionId);
          if (result.success) {
            await markReadyForPayout(commissionId);
          }
        }

        // Find all ready for payout
        const readyForPayout = await getReadyForPayout();
        console.log(`[Payments] Found ${readyForPayout.length} ready for payout`);

        for (const commissionId of readyForPayout) {
          await initiatePayout(commissionId);
        }
      }

      console.log(`[Payments] Job ${job.id} completed`);
    } catch (error) {
      console.error(`[Payments] Job ${job.id} failed:`, error);
      throw error;
    }
  },
  { connection, concurrency: 1 }
);

// Emails Worker
const emailsWorker = new Worker<EmailJobData>(
  QUEUE_NAMES.EMAILS,
  async (job: Job<EmailJobData>) => {
    console.log(`[Emails] Processing job ${job.id}: ${job.data.type}`);

    try {
      const { type, to, data } = job.data;

      switch (type) {
        case "recruiter_approval":
          await sendRecruiterApprovalEmail(
            to,
            data.name,
            data.approved,
            data.reason
          );
          break;

        case "submission_status":
          await sendSubmissionStatusEmail(
            to,
            data.recruiterName,
            data.candidateName,
            data.roleName,
            data.companyName,
            data.newStatus
          );
          break;

        case "payment_notification":
          await sendPaymentNotificationEmail(
            to,
            data.recruiterName,
            data.amount,
            data.candidateName,
            data.roleName,
            data.status
          );
          break;

        case "assessment_complete":
          await sendCandidateAssessmentCompleteEmail(to, data.name);
          break;

        default:
          console.log(`[Emails] Unknown email type: ${type}`);
      }

      console.log(`[Emails] Job ${job.id} completed`);
    } catch (error) {
      console.error(`[Emails] Job ${job.id} failed:`, error);
      throw error;
    }
  },
  { connection, concurrency: 5 }
);

// Recommender Worker
const recommenderWorker = new Worker<RecommenderJobData>(
  QUEUE_NAMES.RECOMMENDER,
  async (job: Job<RecommenderJobData>) => {
    console.log(`[Recommender] Processing job ${job.id}: ${job.data.type}`);

    try {
      if (job.data.type === "find_matches") {
        const matches = await findHiddenTalentForRole(job.data.roleId);
        console.log(
          `[Recommender] Found ${matches.length} matches for role ${job.data.roleId}`
        );
      }

      console.log(`[Recommender] Job ${job.id} completed`);
    } catch (error) {
      console.error(`[Recommender] Job ${job.id} failed:`, error);
      throw error;
    }
  },
  { connection, concurrency: 2 }
);

// Error handlers
assessmentsWorker.on("failed", (job, err) => {
  console.error(`[Assessments] Job ${job?.id} failed:`, err);
});

paymentsWorker.on("failed", (job, err) => {
  console.error(`[Payments] Job ${job?.id} failed:`, err);
});

emailsWorker.on("failed", (job, err) => {
  console.error(`[Emails] Job ${job?.id} failed:`, err);
});

recommenderWorker.on("failed", (job, err) => {
  console.error(`[Recommender] Job ${job?.id} failed:`, err);
});

// Graceful shutdown
async function shutdown() {
  console.log("⏹️ Shutting down workers...");

  await Promise.all([
    assessmentsWorker.close(),
    paymentsWorker.close(),
    emailsWorker.close(),
    recommenderWorker.close(),
  ]);

  await connection.quit();
  await prisma.$disconnect();

  console.log("✅ Workers shut down gracefully");
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

console.log("✅ Workers started successfully");
console.log(`📥 Listening for jobs on queues: ${Object.values(QUEUE_NAMES).join(", ")}`);
