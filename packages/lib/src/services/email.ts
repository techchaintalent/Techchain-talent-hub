import { Resend } from "resend";
import { prisma } from "@techchain/db";
import { env, isDevMode } from "../env";

let resend: Resend | null = null;

function getResend(): Resend {
  if (!resend) {
    if (!env.RESEND_API_KEY && !isDevMode()) {
      throw new Error("RESEND_API_KEY is required in production mode");
    }
    resend = new Resend(env.RESEND_API_KEY || "re_dev_placeholder");
  }
  return resend;
}

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(payload: EmailPayload): Promise<void> {
  if (isDevMode()) {
    // In dev mode, store emails in database for inspection
    await prisma.devEmail.create({
      data: {
        to: payload.to,
        from: env.EMAIL_FROM,
        subject: payload.subject,
        htmlBody: payload.html,
        textBody: payload.text,
      },
    });
    console.log(`📧 [DEV] Email logged to database:`, {
      to: payload.to,
      subject: payload.subject,
    });
    return;
  }

  const client = getResend();
  await client.emails.send({
    from: env.EMAIL_FROM,
    to: payload.to,
    subject: payload.subject,
    html: payload.html,
    text: payload.text,
  });
}

export async function sendMagicLinkEmail(
  email: string,
  magicLink: string
): Promise<void> {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Sign in to TechChain Talent Hub</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .button { display: inline-block; background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { margin-top: 40px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Sign in to TechChain Talent Hub</h1>
          <p>Click the button below to sign in to your account:</p>
          <a href="${magicLink}" class="button">Sign In</a>
          <p>Or copy and paste this URL into your browser:</p>
          <p style="word-break: break-all; color: #666;">${magicLink}</p>
          <p class="footer">
            If you didn't request this email, you can safely ignore it.<br>
            This link will expire in 24 hours.
          </p>
        </div>
      </body>
    </html>
  `;

  await sendEmail({
    to: email,
    subject: "Sign in to TechChain Talent Hub",
    html,
    text: `Sign in to TechChain Talent Hub\n\nClick this link to sign in: ${magicLink}\n\nThis link expires in 24 hours.`,
  });
}

export async function sendRecruiterApprovalEmail(
  email: string,
  name: string,
  approved: boolean,
  reason?: string
): Promise<void> {
  const html = approved
    ? `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>You're Approved!</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .success { color: #059669; }
          .button { display: inline-block; background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1 class="success">🎉 Congratulations, ${name}!</h1>
          <p>Your recruiter account has been approved. You now have full access to the TechChain Talent Hub marketplace.</p>
          <h2>What's Next?</h2>
          <ul>
            <li>Browse available roles in the marketplace</li>
            <li>Request access to roles you want to work on</li>
            <li>Submit qualified candidates</li>
            <li>Earn commissions when your candidates are hired</li>
          </ul>
          <a href="${env.APP_URL}/recruiter/marketplace" class="button">View Marketplace</a>
        </div>
      </body>
    </html>
  `
    : `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Application Update</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Application Update</h1>
          <p>Hi ${name},</p>
          <p>Thank you for your interest in joining TechChain Talent Hub as a recruiter.</p>
          <p>After reviewing your application, we've decided not to move forward at this time.</p>
          ${reason ? `<p><strong>Feedback:</strong> ${reason}</p>` : ""}
          <p>You're welcome to reapply in the future with updated information.</p>
        </div>
      </body>
    </html>
  `;

  await sendEmail({
    to: email,
    subject: approved
      ? "🎉 Your TechChain Recruiter Account is Approved!"
      : "TechChain Talent Hub - Application Update",
    html,
  });
}

export async function sendSubmissionStatusEmail(
  recruiterEmail: string,
  recruiterName: string,
  candidateName: string,
  roleName: string,
  companyName: string,
  newStatus: string
): Promise<void> {
  const statusMessages: Record<string, string> = {
    SCREENING: "is now being screened",
    INTERVIEWING: "has moved to the interview stage",
    OFFER: "has received an offer",
    HIRED: "has been hired",
    STARTED: "has started their new role",
    REJECTED: "was not selected to move forward",
    WITHDRAWN: "has been withdrawn",
  };

  const message = statusMessages[newStatus] || `status changed to ${newStatus}`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Candidate Update</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .status { padding: 10px 20px; background: #f3f4f6; border-radius: 6px; margin: 20px 0; }
          .button { display: inline-block; background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Candidate Update</h1>
          <p>Hi ${recruiterName},</p>
          <p>There's an update on your candidate submission:</p>
          <div class="status">
            <strong>${candidateName}</strong> ${message} for the <strong>${roleName}</strong> role at <strong>${companyName}</strong>.
          </div>
          <a href="${env.APP_URL}/recruiter/submissions" class="button">View Submissions</a>
        </div>
      </body>
    </html>
  `;

  await sendEmail({
    to: recruiterEmail,
    subject: `Candidate Update: ${candidateName} - ${roleName}`,
    html,
  });
}

export async function sendPaymentNotificationEmail(
  recruiterEmail: string,
  recruiterName: string,
  amount: number,
  candidateName: string,
  roleName: string,
  status: "scheduled" | "collected" | "payout_initiated" | "payout_completed"
): Promise<void> {
  const statusContent: Record<string, { title: string; message: string }> = {
    scheduled: {
      title: "Payment Scheduled",
      message: `A payment of $${amount.toLocaleString()} has been scheduled for the placement of ${candidateName} as ${roleName}.`,
    },
    collected: {
      title: "Payment Collected",
      message: `The company payment of $${amount.toLocaleString()} for ${candidateName}'s placement has been collected. Your payout will be processed shortly.`,
    },
    payout_initiated: {
      title: "Payout Initiated",
      message: `Your payout of $${amount.toLocaleString()} for placing ${candidateName} as ${roleName} has been initiated.`,
    },
    payout_completed: {
      title: "Payout Completed! 💰",
      message: `Your payout of $${amount.toLocaleString()} for placing ${candidateName} as ${roleName} has been deposited to your account.`,
    },
  };

  const content = statusContent[status];

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>${content.title}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .amount { font-size: 32px; color: #059669; font-weight: bold; margin: 20px 0; }
          .button { display: inline-block; background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>${content.title}</h1>
          <p>Hi ${recruiterName},</p>
          <p>${content.message}</p>
          <a href="${env.APP_URL}/recruiter/commissions" class="button">View Commissions</a>
        </div>
      </body>
    </html>
  `;

  await sendEmail({
    to: recruiterEmail,
    subject: `TechChain: ${content.title}`,
    html,
  });
}

export async function sendCandidateAssessmentCompleteEmail(
  email: string,
  name: string
): Promise<void> {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Your Assessment is Ready</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .button { display: inline-block; background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Your Assessment is Ready! 📊</h1>
          <p>Hi ${name},</p>
          <p>Great news! We've completed your TechChain Talent Hub assessment. Here's what's waiting for you:</p>
          <ul>
            <li><strong>Crypto Native Score</strong> - How crypto-native is your profile?</li>
            <li><strong>Technical Assessment</strong> - Your skill ratings across key areas</li>
            <li><strong>Role Fit Analysis</strong> - How well you match your target roles</li>
            <li><strong>Personalized Action Plan</strong> - 30/60/90 day roadmap to boost your employability</li>
          </ul>
          <a href="${env.APP_URL}/candidate/dashboard" class="button">View Your Assessment</a>
          <p>Questions? Reply to this email and we'll help you out.</p>
        </div>
      </body>
    </html>
  `;

  await sendEmail({
    to: email,
    subject: "Your TechChain Assessment is Ready! 📊",
    html,
  });
}
