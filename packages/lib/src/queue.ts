import { Queue, Worker, Job } from "bullmq";
import IORedis from "ioredis";
import { env } from "./env";

// Redis connection
let redisConnection: IORedis | null = null;

export function getRedisConnection(): IORedis {
  if (!redisConnection) {
    redisConnection = new IORedis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
    });
  }
  return redisConnection;
}

// Queue names
export const QUEUE_NAMES = {
  ASSESSMENTS: "assessments",
  PAYMENTS: "payments",
  EMAILS: "emails",
  RECOMMENDER: "recommender",
} as const;

// Job types
export interface AssessmentJobData {
  type: "candidate_assessment" | "submission_scoring";
  candidateId?: string;
  submissionId?: string;
  triggeredBy: string;
  assessmentTypes?: string[];
}

export interface PaymentJobData {
  type: "collect_payment" | "initiate_payout" | "check_due_payments";
  commissionId?: string;
}

export interface EmailJobData {
  type: "magic_link" | "recruiter_approval" | "submission_status" | "payment_notification" | "assessment_complete";
  to: string;
  data: Record<string, any>;
}

export interface RecommenderJobData {
  type: "find_matches";
  roleId: string;
}

// Queue factories
let queues: Record<string, Queue> = {};

export function getQueue(name: string): Queue {
  if (!queues[name]) {
    queues[name] = new Queue(name, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 1000,
        },
        removeOnComplete: 100,
        removeOnFail: 1000,
      },
    });
  }
  return queues[name];
}

// Job adding helpers
export async function queueAssessment(data: AssessmentJobData): Promise<string> {
  const queue = getQueue(QUEUE_NAMES.ASSESSMENTS);
  const job = await queue.add("assessment", data, {
    jobId: `assessment-${data.candidateId || data.submissionId}-${Date.now()}`,
  });
  return job.id!;
}

export async function queuePayment(data: PaymentJobData): Promise<string> {
  const queue = getQueue(QUEUE_NAMES.PAYMENTS);
  const job = await queue.add("payment", data, {
    jobId: `payment-${data.type}-${data.commissionId || Date.now()}`,
  });
  return job.id!;
}

export async function queueEmail(data: EmailJobData): Promise<string> {
  const queue = getQueue(QUEUE_NAMES.EMAILS);
  const job = await queue.add("email", data, {
    jobId: `email-${data.type}-${Date.now()}`,
  });
  return job.id!;
}

export async function queueRecommender(data: RecommenderJobData): Promise<string> {
  const queue = getQueue(QUEUE_NAMES.RECOMMENDER);
  const job = await queue.add("recommender", data, {
    jobId: `recommender-${data.roleId}-${Date.now()}`,
  });
  return job.id!;
}

// Schedule recurring jobs
export async function scheduleRecurringJobs(): Promise<void> {
  const paymentQueue = getQueue(QUEUE_NAMES.PAYMENTS);

  // Check for due payments every hour
  await paymentQueue.add(
    "check-due-payments",
    { type: "check_due_payments" },
    {
      repeat: {
        every: 60 * 60 * 1000, // 1 hour
      },
      jobId: "check-due-payments-recurring",
    }
  );

  console.log("Scheduled recurring jobs");
}

// Clean up
export async function closeQueues(): Promise<void> {
  for (const queue of Object.values(queues)) {
    await queue.close();
  }
  queues = {};

  if (redisConnection) {
    await redisConnection.quit();
    redisConnection = null;
  }
}
