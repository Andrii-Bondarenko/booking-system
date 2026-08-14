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

| Method | Path                                     | Purpose                                                     |
| ------ | ---------------------------------------- | ----------------------------------------------------------- |
| POST   | `/students`                              | register a student (`{studentId,email,name,phone}`)         |
| GET    | `/mentors`                               | list active mentors (`?skill=`, `?minExperience=`)          |
| GET    | `/mentors/{mentorId}/timeslots`          | mentor's upcoming available slots                           |
| POST   | `/mentors/{mentorId}/timeslots`          | create slot(s) (`{startTime,endTime}` or `{slots:[]}`)      |
| GET    | `/mentors/{mentorId}/bookings`           | mentor's bookings (`?when=upcoming\|past`)                  |
| POST   | `/bookings`                              | book a session (`{mentorId,slotId,studentId}`)              |
| DELETE | `/bookings/{bookingId}`                  | cancel own booking (`x-student-id`)                         |
| POST   | `/import/mentors`                        | upload mentor CSV (raw body, `text/csv`)                    |
| POST   | `/exports/bookings`                      | trigger a bookings export                                   |

### Data model

- **Mentors** — PK `mentorId`
- **Students** — PK `studentId`
- **TimeSlots** — PK `mentorId`, SK `slotId` (query all of a mentor's slots)
- **Bookings** — PK `bookingId`, GSI `byStudent`, GSI `byMentor` (both sorted by `startTime`)

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

---

## Conventions & deliberate trade-offs (learning notes)

- **Multi-table DynamoDB** (one table per entity) — easier to understand than single-table.
- **Explicit API Gateway routes** (not a catch-all proxy) — the URL tree is visible in code.
- **Dynamoose ODM** — repositories use Dynamoose v4 for schema definition, query building, and
  marshalling. Classic ORMs (Prisma/TypeORM) don't support DynamoDB; Dynamoose is the DynamoDB-
  native alternative.
- **Double-booking guard** — `POST /bookings` claims the slot with an atomic conditional write
  (`markSlotBooked`, `ConditionExpression: status = available`) before writing the booking.
- **Non-transactional writes** — booking + slot updates are two separate writes; a crash between
  them could orphan state. Production fix: DynamoDB `TransactWriteItems`.
- **SNS, not SES** — per the task spec. SNS broadcasts one message to all subscribers, so it
  can't do true per-recipient personalized email; SES would in production.
- **Removal policies = DESTROY** everywhere — convenient teardown for a learning project; use
  `RETAIN` in production.

See `TODO.md` for what's next.
