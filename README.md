# VirtualDNS Landing Backend

A robust backend service for the VirtualDNS landing page, built with Deno and Hono. This service handles email subscriptions, categorizes user interests, and manages automated email delivery through Mailjet.

## Features

- **Email Subscription Management**: Store and manage user subscriptions with different interest levels
- **Multi-language Support**: Automatic language detection with support for English, Spanish, and Portuguese
- **Email Categorization**: Three subscription tiers (interested, tester, adopter) with tailored email templates
- **Rate Limiting**: Request throttling to prevent abuse (3 requests per minute per unique identifier)
- **Automated Email Worker**: Background worker that processes pending emails with retry logic
- **Persistent Storage**: Uses Deno KV for reliable data persistence
- **Cross-Origin Support**: CORS-enabled API endpoints

## Technology Stack

- **Runtime**: [Deno](https://deno.land/)
- **Framework**: [Hono](https://hono.dev/)
- **Storage**: [Deno KV](https://docs.deno.com/kv/manual)
- **Email Service**: Mailjet
- **Validation**: Zod
- **Rate Limiting**: hono-rate-limiter

## Prerequisites

- Deno 1.x or higher
- Mailjet account (API credentials required)

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd landing-backend
```

2. Create a `.env` file in the root directory with the following variables:
```env
# Environment
ENVIRONMENT=development  # or production

# Mailjet Configuration
MAIL_SERVICE=MAILJET
MAILJET_FROM=your-email@example.com
MAILJET_HOST=in-v3.mailjet.com
MAILJET_PORT=587
MAILJET_API_KEY=your-mailjet-api-key
MAILJET_API_SECRET=your-mailjet-api-secret
```

## Usage

### Development Mode

Run the server with hot-reloading:

```bash
deno task dev
```

### Production Mode

Start the server:

```bash
deno task start
```

The server will start on the default Deno port (typically 8000).

## API Endpoints

### POST /subscribe

Subscribe a user to the VirtualDNS mailing list.

**Headers:**
- `x-i` (required): UUID identifier for rate limiting
- `Accept-Language` (optional): Language preference (en, es, pt)

**Request Body:**
```json
{
  "email": "user@example.com",
  "cta": "interested",  // Options: "interested", "tester", "adopter"
  "refer": "x"         // Optional. Options: "x", "whatsapp", "reddit"
}
```

**Responses:**
- `201`: Subscription created successfully
- `409`: Email already subscribed
- `429`: Rate limit exceeded
- `500`: Internal server error

**Subscription Types:**
- `interested`: Added to the general waitlist
- `tester`: Priority waitlist for beta testers
- `adopter`: VIP early adopters with exclusive benefits

### GET /health

Health check endpoint.

**Response:**
- `200`: Service is healthy

## Email Processing

The service includes an automated email worker that:

1. Watches for new subscriptions in the database
2. Processes pending emails automatically
3. Implements retry logic (up to 3 attempts)
4. Tracks email status (pending, sent, failed)
5. Stores delivery information and error logs

### Email Templates

Email templates are located in the `assets/` directory, organized by language:

```
assets/
├── en/
│   ├── virtualdns-waitlist-confirmation.html
│   ├── virtualdns-early-access-confirmation.html
│   └── virtualdns-production-commitment.html
├── es/
│   └── [same files in Spanish]
└── pt/
    └── [same files in Portuguese]
```

## Rate Limiting

The API implements rate limiting to prevent abuse:
- **Window**: 1 minute
- **Limit**: 3 requests per unique identifier
- **Identifier**: Based on the `x-i` header (UUID)

## Project Structure

```
landing-backend/
├── main.ts                 # Application entry point and routes
├── deno.json              # Deno configuration and dependencies
├── .env                   # Environment variables (not in repo)
├── README.md              # This file
├── assets/                # Email templates by language
│   ├── en/
│   ├── es/
│   └── pt/
└── src/
    ├── email.service.ts   # Email sending logic with Mailjet
    └── logger.ts          # Logging utility
```

## Data Model

### Email Subscription

```typescript
{
  email: string;              // User's email address
  cta: EmailCategory;         // Subscription type
  language: string;           // Detected language (en, es, pt)
  emailStatus: EmailStatus;   // pending | sent | failed
  subscribedAt: string;       // ISO timestamp
  createdAt: string;          // ISO timestamp
  emailSentAt?: string;       // ISO timestamp
  emailError?: string;        // Error message if failed
  retryCount: number;         // Number of send attempts
  lastRetryAt?: string;       // ISO timestamp of last retry
  refer?: string;             // Referral source
}
```

## Error Handling

The service includes comprehensive error handling:
- Input validation with Zod schemas
- Email delivery retry logic (3 attempts)
- Error logging for debugging
- Graceful failure modes

## Development

### Adding New Email Templates

1. Create HTML templates in `assets/[language]/`
2. Update the `templateMap` in `email.service.ts`
3. Add corresponding subjects in `subjectMap`
4. Add text content in `textContentMap`

### Extending Subscription Types

1. Update the `bodySchema` in `main.ts`
2. Add new template mappings in `email.service.ts`
3. Create corresponding email templates

## Support

For questions or issues, please contact the VirtualDNS team.
