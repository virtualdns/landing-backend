import { Hono } from "hono";
import { cors } from "hono/cors";
import * as z from 'zod';
import { zValidator } from '@hono/zod-validator';
import { STATUS_CODE } from "@std/http";
import { languageDetector } from 'hono/language';
import { rateLimiter } from "hono-rate-limiter";
import { EmailService, type EmailCategory } from "./src/email.service.ts";
import { Logger } from "./src/logger.ts";
import { HashService } from "./src/hash.service.ts";

const bodySchema = z.object({
  email: z.email().max(50).trim(),
  cta: z.enum(['interested', 'tester', 'adopter']),
  refer: z.enum(['x', 'whatsapp', 'reddit']).optional(),
});

const headerSchema = z.object({
  "x-i": z.string().min(15).max(150).includes(":").trim(),
});

export enum EmailStatus {
  Pending = "pending",
  Sent = "sent",
  Failed = "failed",
}

interface IEmailSubscription {
  email: string;
  cta: EmailCategory;
  language: string;
  emailStatus: EmailStatus;
  subscribedAt: string;
  createdAt: string;
  emailSentAt?: string;
  emailError?: string;
  retryCount: number;
  lastRetryAt?: string;
  refer?: string;
}

const app = new Hono();
const kv = await Deno.openKv();
const emailService = new EmailService();

app.use(
  languageDetector({
    supportedLanguages: ['en', 'es', 'pt'],
    fallbackLanguage: 'en',
  })
);

app.use("*", cors({ origin: () => Deno.env.get("CORS_ORIGIN") || "*" }));

// POST endpoint to receive and store email
app.post("/subscribe",
  zValidator('header', headerSchema),
  rateLimiter({
    windowMs: 1 * 60 * 1000,
    limit: 3,
    standardHeaders: "draft-6",
    keyGenerator: (c) => c.req.header("x-i")!,
  }),
  zValidator('json', bodySchema), async (c) => {
    const lang = c.get('language');

    try {
      const body = c.req.valid('json');
      const { email, cta, refer } = body;

      Logger.log("Subscribe endpoint called");
      Logger.log(`  → Email: ${email}`);
      Logger.log(`  → CTA: ${cta}`);
      Logger.log(`  → Refer: ${refer || 'none'}`);
      Logger.log(`  → Language: ${lang}`);

      const idHeader = c.req.header("x-i");
      const identifySalt = Deno.env.get("IDENTIFY_SALT");

      if (!identifySalt) {
        Logger.error("IDENTIFY_SALT environment variable is not set");
        return c.json({}, STATUS_CODE.InternalServerError);
      }

      if (!idHeader) {
        Logger.log("Id header missing - Returning 401 Unauthorized");
        return c.json({}, STATUS_CODE.Unauthorized);
      }

      Logger.log("Validating id token...");
      const isValidToken = await HashService.validateAuthToken(idHeader, identifySalt);

      if (!isValidToken) {
        Logger.log("Invalid id token - Returning 401 Unauthorized");
        return c.json({}, STATUS_CODE.Unauthorized);
      }

      Logger.log("id token validated successfully");

      Logger.log("Checking if email already exists in database...");
      const storedEmail = await kv.get(["emails", email]);

      if (storedEmail.value !== null) {
        Logger.log(`Email already exists: ${email} - Returning 409 Conflict`);
        return c.json({}, STATUS_CODE.Conflict);
      }

      Logger.log("Email does not exist, proceeding with subscription...");
      const now = new Date().toISOString();
      // Store email in Deno.kv with pending status
      const subscription: IEmailSubscription = {
        email: email,
        cta: cta as EmailCategory,
        language: lang,
        emailStatus: EmailStatus.Pending,
        createdAt: now,
        subscribedAt: now,
        retryCount: 0,
        refer: refer,
      };

      Logger.log("Storing subscription in database...");
      await kv.set(["emails", email], subscription);

      // Trigger the email worker by updating a notification key
      await kv.set(["email_notifications"], { timestamp: now });
      Logger.log(`✓ Subscription stored successfully for: ${email}`);

      return c.json({}, STATUS_CODE.Created);
    } catch (error) {
      Logger.error("Error processing subscription:", error);

      return c.json({}, STATUS_CODE.InternalServerError);
    }
  });

// GET endpoint to generate an identifier
app.get("/identify", async (c) => {
  try {
    Logger.log("Identify endpoint called");

    const identifySalt = Deno.env.get("IDENTIFY_SALT");

    if (!identifySalt) {
      Logger.error("IDENTIFY_SALT environment variable is not set");
      return c.json({}, STATUS_CODE.InternalServerError);
    }

    const randomId = HashService.generateRandomString(15);
    Logger.log(`  → Generated random ID: ${randomId}`);

    const hashedKey = await HashService.hash(randomId, identifySalt);
    Logger.log(`  → Generated hash key: ${hashedKey}`);

    return c.json({
      key: hashedKey,
      id: randomId,
    }, STATUS_CODE.OK);
  } catch (error) {
    Logger.error("Error processing identify request:", error);

    return c.json({}, STATUS_CODE.InternalServerError);
  }
});

// Email processing worker using Deno.kv watch
async function startEmailWorker() {
  Logger.log("Starting email worker...");

  const stream = kv.watch([["email_notifications"]]);

  for await (const _entries of stream) {
    Logger.log("Database change detected, checking for pending emails...");

    // Get all emails with pending status
    const iter = kv.list<IEmailSubscription>({ prefix: ["emails"] });

    for await (const entry of iter) {
      const subscription = entry.value;

      if (subscription.emailStatus === EmailStatus.Pending) {
        Logger.log(`Processing pending email for: ${subscription.email}`);

        const maxRetries = 3;
        let lastError: Error | unknown = null;
        let emailSent = false;

        // Try to send email up to 3 times
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            Logger.log(`  → Attempt ${attempt}/${maxRetries} for: ${subscription.email}`);

            await emailService.sendCategorizedEmail(
              subscription.email,
              subscription.cta,
              subscription.language
            );

            emailSent = true;
            Logger.log(`  ✓ Email sent successfully on attempt ${attempt}`);
            break;
          } catch (error) {
            lastError = error;
            Logger.error(`  ✗ Attempt ${attempt} failed:`, error instanceof Error ? error.message : String(error));

            if (attempt < maxRetries) {
              Logger.log(`  ⟳ Retrying...`);
            }
          }
        }

        // Update subscription based on result
        if (emailSent) {
          const updatedSubscription: IEmailSubscription = {
            ...subscription,
            emailStatus: EmailStatus.Sent,
            emailSentAt: new Date().toISOString(),
            retryCount: 0,
          };

          await kv.set(["emails", subscription.email], updatedSubscription);
          Logger.log(`✓ Email successfully sent to: ${subscription.email}`);
        } else {
          const updatedSubscription: IEmailSubscription = {
            ...subscription,
            emailStatus: EmailStatus.Failed,
            emailError: lastError instanceof Error ? lastError.message : String(lastError),
            retryCount: maxRetries,
            lastRetryAt: new Date().toISOString(),
          };

          await kv.set(["emails", subscription.email], updatedSubscription);
          Logger.log(`✗ Email failed after ${maxRetries} attempts for: ${subscription.email}`);
        }
      }
    }
  }
}

// Start the email worker in the background
startEmailWorker().catch((error) => {
  Logger.error("Email worker error:", error);
});

Deno.serve(app.fetch);
