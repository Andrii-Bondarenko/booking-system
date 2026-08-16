# MentorBooking — AWS Node.js Course

A serverless mentorship-booking backend built with **AWS CDK + TypeScript**. Students find
mentors and book sessions; mentors manage availability; admins bulk-import mentors and export
bookings. All async work (emails, imports, exports) runs off the request path via SQS.

> This is a **learning project**, built step by step. The code favours clarity over cleverness
> (multi-table DynamoDB, explicit API Gateway routes, hand-written repositories).

---

## Architecture

```
                    ┌──────────────── API Gateway (REST) ────────────────┐
  students/mentors →│  /mentors · /timeslots · /bookings                  │→ ┌───────────────┐
  admins           →│  /import/mentors · /exports/bookings                │  │ Booking API λ │
                    └─────────────────────────────────────────────────────┘  └──┬────────┬───┘
                                                                     enqueue job │        │ send event
   upload CSV → [S3 Imports] ──ObjectCreated──▶ [CSV Processor λ] ─writes─▶ [DynamoDB]     │
                                                     │                                      │
                                                     └── mentors.imported ──┐               │
                                                                            ▼               ▼
   [Exports Queue] ─▶ [Export λ] ─scan─▶ [DynamoDB]           [Notifications Queue] ◀───────┘
          ▲                └─writes CSV─▶ [S3 Exports]                 │  (booking.*, *.imported,
          │                                └── bookings.exported ──────┤   bookings.exported)
   POST /exports/bookings                                              ▼
                                                          [Notification λ] ─publish─▶ [SNS] → 📧
```

**AWS services:** API Gateway, Lambda (4 functions), DynamoDB (4 tables), SQS (2 queues + 2
dead-letter queues), SNS (1 topic), S3 (2 buckets). Everything is defined as code with CDK.

### The four Lambdas & how they're triggered

| Lambda            | Trigger                        | Does                                               |
| ----------------- | ------------------------------ | -------------------------------------------------- |
| **Booking API**   | API Gateway (HTTP)             | serves every REST endpoint via an in-Lambda router |
| **Notification**  | SQS (Notifications queue)      | renders + publishes emails to SNS                  |
| **CSV Processor** | S3 (`mentors-import/` uploads) | parses CSV → writes mentors → emits summary        |
| **Export**        | SQS (Exports queue)            | scans bookings → writes CSV to S3 → emits link     |

---

## Project layout

```
.
├── bin/
│   └── app.ts                      CDK app entry point (instantiates the stack)
├── lib/                            INFRASTRUCTURE (CDK)
│   ├── booking-system-stack.ts     thin: wires the 4 constructs together
│   └── constructs/
│       ├── data.construct.ts       DynamoDB tables + GSIs
│       ├── messaging.construct.ts  SQS queues (+ DLQs) + SNS topic
│       ├── storage.construct.ts    S3 buckets
│       └── compute.construct.ts    Lambdas + API Gateway + triggers + IAM grants
├── src/                            APPLICATION CODE (Lambda runtime)
│   ├── student/                    student.model · student.repository · student.handler
│   ├── mentor/                     mentor.model · mentor.repository · mentor.service · mentor.handler
│   ├── timeslot/                   timeslot.model · timeslot.repository · timeslot.service · timeslot.handler
│   ├── booking/                    booking.model · booking.repository · booking.service · booking.handler
│   ├── admin/                      admin.service · admin.handler
│   ├── handlers/                   LAMBDA ENTRY POINTS (thin — import from entity folders)
│   │   ├── api.ts                  router: "METHOD /resource" → entity handler
│   │   ├── notifications.ts        SQS → SNS
│   │   ├── csv-processor.ts        S3 → mentor repo → SQS
│   │   └── export.ts               SQS → booking repo → S3 → SQS
│   └── lib/                        shared helpers
│       ├── config.ts               typed access to env vars
│       ├── events.ts               SQS message contracts (producer ⇄ consumer)
│       ├── http.ts                 HttpError + response/body/header helpers
│       ├── time.ts                 ISO validation + interval-overlap math
│       ├── storage.ts              S3 get/put helpers
│       └── messaging.ts            publishNotification / publishExportJob (SQS)
├── local/                          LOCAL DEVELOPMENT
│   ├── .env                        env vars for local:* scripts
│   ├── setup.ts                    create DynamoDB tables + SQS queues (run once)
│   ├── seed.ts                     insert test mentors + students into DynamoDB Local
│   ├── server.ts                   HTTP server wrapping the Lambda handler
│   └── postman.collection.json     Postman collection for manual testing
├── docker-compose.yml              DynamoDB Local + ElasticMQ
├── cdk.json                        CDK config (runs bin/app.ts via tsx)
├── tsconfig.json                   TS config for src/ (Lambda code)
└── tsconfig.cdk.json               TS config for lib/ + bin/ (infra code)
```

### The layering rule

Each entity folder contains up to three layers:

```
*.handler    →  parse the HTTP event, call a service, format the response   (thin)
*.service    →  business rules: validation, overlap checks, orchestration, emit events
*.repository →  DynamoDB (via Dynamoose) — table/index/key knowledge lives here
*.model      →  TypeScript interface + Dynamoose schema in one place
```

Benefits: services are testable without HTTP or AWS; swapping the data store touches only
the repositories; adding a field means editing one file (`*.model.ts`), not two.

---

## API endpoints

Identity is passed via the `x-student-id` header (or `?studentId=`) for student-scoped calls —
there is no real auth in this learning project.

| Method | Path                            | Purpose                                                |
| ------ | ------------------------------- | ------------------------------------------------------ |
| POST   | `/students`                     | register a student (`{studentId,email,name,phone}`)    |
| GET    | `/mentors`                      | list active mentors (`?skill=`, `?minExperience=`)     |
| GET    | `/mentors/{mentorId}/timeslots` | mentor's upcoming available slots                      |
| POST   | `/mentors/{mentorId}/timeslots` | create slot(s) (`{startTime,endTime}` or `{slots:[]}`) |
| GET    | `/mentors/{mentorId}/bookings`  | mentor's bookings (`?when=upcoming\|past`)             |
| POST   | `/bookings`                     | book a session (`{mentorId,slotId,studentId}`)         |
| DELETE | `/bookings/{bookingId}`         | cancel own booking (`x-student-id`)                    |
| POST   | `/import/mentors`               | upload mentor CSV (raw body, `text/csv`)               |
| POST   | `/exports/bookings`             | trigger a bookings export                              |

### Data model

- **Mentors** — PK `mentorId`
- **Students** — PK `studentId`
- **TimeSlots** — PK `mentorId`, SK `slotId` (query all of a mentor's slots)
- **Bookings** — PK `bookingId`, GSI `byStudent`, GSI `byMentor` (both sorted by `startTime`)

---

## Local development

The full booking flow (students, mentors, timeslots, bookings) runs locally against
**DynamoDB Local** and **ElasticMQ** (SQS-compatible) — no AWS account needed.

### Prerequisites

- Docker (for DynamoDB Local + ElasticMQ)
- AWS CLI (optional, for seeding data via `aws dynamodb put-item`)

### Start

```bash
npm run local:up      # start DynamoDB Local (port 8000) + ElasticMQ (port 9324)
npm run local:setup   # create tables + queues (run once, or after local:down)
npm run local:dev     # start HTTP server on http://localhost:3001
```

### Seed test data

Mentors are normally imported via CSV upload (which requires S3). For local testing,
`local/seed.ts` inserts 2 active mentors + 2 students directly into DynamoDB Local:

```bash
npm run local:seed
```

Safe to re-run — existing records are overwritten by primary key.

### Test with Postman

Import `local/postman.collection.json`. The collection covers the full happy path and
includes edge-case requests (double-book → 409, wrong student cancel → 403). Test
scripts auto-save IDs between requests so you can run them top to bottom.

### Inspecting local data

**DynamoDB — web UI** (recommended):

```bash
DYNAMO_ENDPOINT=http://localhost:8000 npx dynamodb-admin
```

Opens `http://localhost:8001` — browse tables, scan/query items, edit and delete records.
No global install needed; `npx` downloads it on first run.

**DynamoDB — AWS CLI:**

```bash
# list all tables
aws dynamodb list-tables \
  --endpoint-url http://localhost:8000 --region us-east-1

# scan a whole table
aws dynamodb scan \
  --endpoint-url http://localhost:8000 --region us-east-1 \
  --table-name mentors

# fetch one item
aws dynamodb get-item \
  --endpoint-url http://localhost:8000 --region us-east-1 \
  --table-name mentors \
  --key '{"mentorId": {"S": "mentor-1"}}'
```

**SQS — AWS CLI:**

ElasticMQ has no web UI. Use the AWS CLI pointed at `http://localhost:9324`.

```bash
# list queues
aws sqs list-queues \
  --endpoint-url http://localhost:9324 --region us-east-1

# count messages waiting in a queue
aws sqs get-queue-attributes \
  --endpoint-url http://localhost:9324 --region us-east-1 \
  --queue-url http://localhost:9324/000000000000/notifications \
  --attribute-names ApproximateNumberOfMessages

# peek at up to 10 messages (does not delete them)
aws sqs receive-message \
  --endpoint-url http://localhost:9324 --region us-east-1 \
  --queue-url http://localhost:9324/000000000000/notifications \
  --max-number-of-messages 10 \
  --visibility-timeout 0
```

> `--visibility-timeout 0` returns messages to the queue immediately after reading,
> so they are not lost and the Notification Lambda can still process them on AWS.

### What works locally

| Feature                  | Local                                            |
| ------------------------ | ------------------------------------------------ |
| Students CRUD            | ✅                                               |
| Mentors list + filter    | ✅                                               |
| Time slots create / list | ✅                                               |
| Bookings create / cancel | ✅ (SQS events land in ElasticMQ)                |
| Mentor CSV import        | ❌ needs S3                                      |
| Bookings CSV export      | ❌ needs S3                                      |
| Email notifications      | ❌ messages queue in ElasticMQ, no consumer runs |

SQS messages for booking events are visible in the ElasticMQ web UI at
`http://localhost:9325`.

### Stop

```bash
npm run local:down    # stop containers (data is lost — DynamoDB runs in-memory)
```

---

## Commands

```bash
npm run build                       # tsc (emit)
npx tsc --noEmit -p tsconfig.json   # type-check only — the real correctness gate
npx cdk synth                       # generate CloudFormation locally (no AWS needed)
npx cdk diff                        # compare code vs deployed stack
npx cdk bootstrap                   # one-time per account/region before first deploy
npx cdk deploy                      # deploy to AWS (prints the API URL)
npx cdk destroy                     # tear everything down (safe: RemovalPolicy.DESTROY)
npm run prettier                    # format
```

> **Note:** `cdk synth`/`deploy` bundle the Lambdas with **esbuild**, which strips types
> _without_ checking them. Always run `tsc --noEmit` to actually validate types.
