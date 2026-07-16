# SPEC 01 — Client management (backend CRUD)

> **Status:** Implemented
> **Depends on:** —
> **Date:** 2026-07-16
> **Objective:** Expose full REST CRUD for `Client` over Prisma + PostgreSQL using inheritance-by-composition (`Entity` ← `Client`), soft-delete and initial seed.

---

## Scope

**In:**

- Prisma ORM setup: `prisma/schema.prisma`, Prisma Client generation, `PrismaModule` + `PrismaService` in `src/common/` exposing `PrismaClient` with `onModuleInit`/`onModuleDestroy` lifecycle hooks.
- Prisma datasource driven by `DATABASE_URL` env var. Local dev points at local Postgres; the same variable will point at the managed Postgres URL in PROD without code changes. `.env` gitignored; `.env.example` committed.
- Prisma models:
  - `Entity` — `id Int @id @default(autoincrement())`, `type EntityType`, mapped to table `entities`.
  - `Client` — `id Int @id` (FK 1-to-1 to `Entity.id`), `name`, `nro_doc @unique`, `address`, `ubication`, `email @unique` (stored lowercase), `web String?`, `status Status @default(activo)`, `createdAt`, `updatedAt`, `deletedAt DateTime?`, mapped to table `clients`.
  - Enums `EntityType { client, place, event }` and `Status { activo, inactivo }` as Postgres enums.
- Initial migration `prisma migrate dev --name init_clients` creating `entities`, `clients`, enums, indexes.
- Seed script `prisma/seed.ts` inserting 3 sample clients (Spanish data) with each `Entity` + `Client` pair inside its own interactive transaction, wired via `package.json` `prisma.seed`.
- NestJS module `clients` under `src/modules/clients/`:
  - `clients.module.ts`, `clients.controller.ts`, `clients.service.ts`
  - `dto/create-client.dto.ts`, `dto/update-client.dto.ts` (via `PartialType`)
  - `pipes/client-by-id/client-by-id.pipe.ts` resolving `:id` → `Client` via `PrismaService`, filtering `status='activo'` AND `deletedAt IS NULL`, throwing `NotFoundException` otherwise.
- REST endpoints under `/clients`:
  - `GET /clients` — list where `status='activo'` AND `deletedAt IS NULL`.
  - `GET /clients/:id` — single active client (through pipe).
  - `POST /clients` — create (status forced `activo`, timestamps by Prisma).
  - `PATCH /clients/:id` — partial update on active client.
  - `DELETE /clients/:id` — soft-delete: set `deletedAt=now()`, `status='inactivo'`.
- DTOs with `class-validator` + global `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })` in `main.ts`.
- All responses wrapped with `buildResponse(...)` returning `ServiceResponse<Client>`; singulars return `data: [entity]`.
- Uniqueness enforced at DB (unique indexes) + pre-check in service to return friendlier `ConflictException`.
- Global exception filter reused if present in `common/`; otherwise scaffolded minimally to shape errors as `ServiceResponse`.

**Out of scope (for future specs):**

- Frontend / UI.
- Unit + E2E test suites (Prisma mocking strategy deferred).
- Authentication module and JWT guard wiring (endpoints stay `@Public()` / unprotected for now).
- Restore endpoint for soft-deleted clients.
- Pagination, search, sort, filters beyond the active-status filter.
- `Place` and `Event` modules (share `Entity` base, land in their own specs).
- Audit interceptor persistence.
- Multi-tenant / dynamic Prisma clients.
- Prisma `softDelete` middleware (handled explicitly per query in this spec).

---

## Data model

### Prisma schema (`prisma/schema.prisma`)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum EntityType {
  client
  place
  event
}

enum Status {
  activo
  inactivo
}

model Entity {
  id     Int        @id @default(autoincrement())
  type   EntityType

  client Client?

  @@map("entities")
}

model Client {
  id        Int       @id
  name      String    @db.VarChar(120)
  nro_doc   String    @unique @db.VarChar(40)
  address   String    @db.VarChar(200)
  ubication String    @db.VarChar(200)
  email     String    @unique @db.VarChar(160)
  web       String?   @db.VarChar(200)
  status    Status    @default(activo)
  createdAt DateTime  @default(now())    @map("created_at")
  updatedAt DateTime  @updatedAt         @map("updated_at")
  deletedAt DateTime? @map("deleted_at")

  entity    Entity    @relation(fields: [id], references: [id], onDelete: Cascade)

  @@index([status, deletedAt])
  @@map("clients")
}
```

### Response contract

```ts
// common/interfaces/service-response.interface.ts (assumed present)
interface ServiceResponse<T> {
  statusCode: number;
  message: string;
  data: T[];
  metaData?: Record<string, unknown>;
}
```

### DTOs

```ts
// dto/create-client.dto.ts
class CreateClientDto {
  @IsString() @Length(2, 120) name: string;
  @IsString() @Length(1, 40)  nro_doc: string;
  @IsString() @Length(1, 200) address: string;
  @IsString() @Length(1, 200) ubication: string;
  @IsEmail() @Transform(({ value }) => value.toLowerCase().trim()) email: string;
  @IsOptional() @IsUrl() @MaxLength(200) web?: string | null;
}

// dto/update-client.dto.ts
class UpdateClientDto extends PartialType(CreateClientDto) {}
```

### Conventions

- Table names snake_case (`entities`, `clients`).
- Column names snake_case at DB (`created_at`, `updated_at`, `deleted_at`, `nro_doc`).
- `Client.id` mirrors `Entity.id` (shared PK); creation flow inserts `Entity` first, then `Client` with returned id, inside a single interactive `prisma.$transaction`.
- `email` normalized to lowercase before persistence and comparison.
- Soft-delete: `deletedAt` set + `status='inactivo'`. Reads always filter `deletedAt: null` AND `status: 'activo'`.
- Sample seed rows (Spanish data): 3 clients with realistic AR values (name, nro_doc CUIT-like, address, ubication, email, web).

---

## Implementation plan

1. **Install deps.** Add `prisma`, `@prisma/client`, `class-validator`, `class-transformer`, `@nestjs/mapped-types` (if missing). Run `npx prisma init`. Commit `.env.example` with `DATABASE_URL="postgresql://user:pass@localhost:5432/eventapp?schema=public"`. Verify build passes.
2. **Write `prisma/schema.prisma`.** Add enums `EntityType`, `Status`, models `Entity`, `Client` as defined in Data model. Run `npx prisma migrate dev --name init_clients` locally against Postgres. Verify tables created via `psql \dt`.
3. **Create `PrismaModule` + `PrismaService`.** Location: `src/common/prisma/`. `PrismaService` extends `PrismaClient` with `onModuleInit` (calls `$connect`) and `enableShutdownHooks(app)`. `PrismaModule` global (`@Global()`), exports `PrismaService`. Register in `AppModule`. Manual test: boot app, no errors.
4. **Add response helper.** If `src/common/helpers/build-response.ts` and `ServiceResponse` interface do not exist, create them. `buildResponse<T>(statusCode, message, data, metaData?)` returns `ServiceResponse<T>` where `data` is always array.
5. **Add global `ValidationPipe`** in `main.ts` (`whitelist: true, forbidNonWhitelisted: true, transform: true`). Add global exception filter if not present, shaping unhandled errors into `ServiceResponse`.
6. **Scaffold `clients` module.** Create `src/modules/clients/{clients.module.ts,clients.controller.ts,clients.service.ts,dto/,pipes/client-by-id/}`. Register in `AppModule`. Empty controller returning stub. App boots.
7. **Implement DTOs.** `CreateClientDto` + `UpdateClientDto` (`PartialType`) as in Data model.
8. **Implement `ClientByIdPipe`.** `PipeTransform<string, Promise<Client>>`. Parses id to int, queries `prisma.client.findFirst({ where: { id, status: 'activo', deletedAt: null } })`. Throws `NotFoundException('Client not found')` if null.
9. **Implement `ClientsService` — reads.**
   - `findAllActive(): Promise<Client[]>` → `findMany({ where: { status: 'activo', deletedAt: null }, orderBy: { id: 'asc' } })`.
   - `findOneById(id): Promise<Client | null>` (no `buildResponse` per convention).
10. **Implement `ClientsService.create(dto)` — atomic two-table insert.**
    - Normalize `email` lowercase.
    - Pre-check uniqueness on `nro_doc` + `email` (throw `ConflictException` before opening tx).
    - Open interactive transaction: `return prisma.$transaction(async (tx) => { ... }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted })`.
      1. `const entity = await tx.entity.create({ data: { type: 'client' } });`
      2. `const client = await tx.client.create({ data: { id: entity.id, ...dto, status: 'activo' } });`
      3. `return client;`
    - Any failure inside the callback (Prisma error, `P2002` unique violation, connection drop) throws → Prisma **rolls back both inserts automatically**. No partial state possible: either both rows exist or neither.
    - Catch `P2002` outside the transaction, map to `ConflictException` with the offending field name.
11. **Implement `ClientsService.update(client, dto)`.** Receives entity from pipe. Normalize `email` if present. Pre-check uniqueness excluding own id. `prisma.client.update({ where: { id: client.id }, data: dto })`. Return updated.
12. **Implement `ClientsService.softDelete(client)`.** `prisma.client.update({ where: { id: client.id }, data: { deletedAt: new Date(), status: 'inactivo' } })`. Return updated.
13. **Wire `ClientsController`.**
    - `GET /clients` → `findAllActive`, wrap `buildResponse(200, 'ok', list)`.
    - `GET /clients/:id` → `@Param('id', ClientByIdPipe) client`, wrap `buildResponse(200, 'ok', [client])`.
    - `POST /clients` → `create(dto)`, wrap `buildResponse(201, 'created', [client])`.
    - `PATCH /clients/:id` → pipe + `update(client, dto)`, wrap `buildResponse(200, 'updated', [client])`.
    - `DELETE /clients/:id` → pipe + `softDelete(client)`, wrap `buildResponse(200, 'deleted', [client])`.
    Controller has zero `try/catch`.
14. **Seed script `prisma/seed.ts`.** Inserts 3 clients (Spanish data), each pair `Entity` + `Client` inside its own interactive `$transaction`. Idempotent via upsert on `nro_doc`. Wire in `package.json`: `"prisma": { "seed": "ts-node prisma/seed.ts" }`. Guarded by `NODE_ENV !== 'production'`. Run `npx prisma db seed`, verify rows.
15. **Manual smoke test.** Boot app, exercise all 5 endpoints with `curl` / REST client: create → list → get → update → delete → list (deleted absent) → get deleted returns 404.

---

## Acceptance criteria

- [ ] `npx prisma migrate dev` runs clean; `entities` and `clients` tables exist in local Postgres with expected columns, enums and unique indexes on `clients.nro_doc` and `clients.email`.
- [ ] `npx prisma db seed` inserts exactly 3 client rows on a clean DB and is idempotent on re-run (no duplicates, no errors).
- [ ] App boots without errors and `PrismaService` connects to Postgres on startup.
- [ ] `POST /clients` with valid body returns HTTP 201 and `ServiceResponse` with `data: [client]`; inserts one row in `entities` (type=`client`) and one in `clients` sharing the same `id`.
- [ ] `POST /clients` with invalid body (missing `name`, malformed `email`, extra unknown field) returns HTTP 400 from global `ValidationPipe`.
- [ ] `POST /clients` with duplicate `nro_doc` or duplicate `email` (case-insensitive) returns HTTP 409 `ConflictException`.
- [ ] Forcing a failure on the second insert (e.g. seed a duplicate `email` and retry `POST /clients` with same email) rolls back the first insert: `entities` row count is unchanged after the failed request.
- [ ] `GET /clients` returns only rows where `status='activo'` AND `deletedAt IS NULL`.
- [ ] `GET /clients/:id` on active client returns HTTP 200 with `data: [client]` (single-element array).
- [ ] `GET /clients/:id` on non-existent, inactive, or soft-deleted id returns HTTP 404.
- [ ] `PATCH /clients/:id` partial update persists only sent fields; unaffected fields remain unchanged; `updatedAt` advances.
- [ ] `PATCH /clients/:id` rejects updates that would violate unique `nro_doc` or `email` against another client (HTTP 409).
- [ ] `DELETE /clients/:id` sets `deletedAt` to non-null and `status='inactivo'`; the row remains physically in DB.
- [ ] After `DELETE`, the same id disappears from `GET /clients` and returns 404 on `GET /clients/:id`.
- [ ] Controller files contain zero `try/catch` blocks.
- [ ] Every controller response goes through `buildResponse(...)`.
- [ ] `ClientByIdPipe` is applied on every `@Param('id', ...)` in `ClientsController`.
- [ ] Email is stored lowercase regardless of input casing.

---

## Decisions

- **Yes:** Prisma + PostgreSQL local. Conscious deviation from the `nestjs-backend-conventions` skill (TypeORM). Reason: user explicit choice for this project.
- **No:** TypeORM + QueryRunner. Skipped despite being the skill default — Prisma covers transactions via `$transaction` with simpler ergonomics.
- **Yes:** Class Table Inheritance modeled as `Entity` (parent) 1-to-1 `Client` (child) sharing PK. Reason: keeps `entities.type` polymorphic while child columns stay in their own table; scales to `Place`, `Event` without column bloat.
- **No:** Single Table Inheritance with discriminator column. Reason: sparse columns, weaker constraints.
- **No:** Independent tables per entity without shared `entities`. Reason: loses the shared `Entity` contract from `libs/shared-types`.
- **Yes:** `Client` creation uses Prisma **interactive transaction** (`$transaction(async tx => ...)`) with `ReadCommitted` isolation. Reason: `Entity` and `Client` inserts must succeed together or fail together; interactive tx guarantees atomic rollback on any error inside the callback.
- **No:** Sequential inserts without transaction. Reason: a crash between the two writes would leave an orphan `entities` row with no `clients` counterpart.
- **No:** Prisma **batch** transaction (`prisma.$transaction([...])`). Reason: batch form does not let step 2 read `entity.id` from step 1's result; the interactive form is required for dependent writes.
- **Yes:** Same atomic pattern applied in `prisma/seed.ts` — each `Entity` + `Client` pair inserted inside its own interactive tx.
- **Yes:** Soft-delete via `deletedAt` + `status='inactivo'` set together. Reason: contract in `Client` type already includes both fields; keeps semantic consistency (an active client cannot be soft-deleted).
- **No:** Prisma middleware to auto-filter soft-deleted rows. Reason: explicit filters in queries are easier to reason about at this stage; middleware can land later without breaking API.
- **Yes:** Email normalized to lowercase in DTO transform + unique index at DB. Reason: case-insensitive uniqueness without functional index complexity.
- **Yes:** Pre-check uniqueness in service before insert/update. Reason: return `409 Conflict` with actionable message instead of raw Prisma `P2002`.
- **No:** Pagination, search, sort. Reason: user deferred; volumes low initially.
- **No:** Auth guard wiring. Reason: no auth module yet; endpoints stay open in local dev. Will land in its own spec.
- **Yes:** Global `ValidationPipe` with `whitelist`/`forbidNonWhitelisted`/`transform`. Reason: rejects unknown fields, keeps DTOs authoritative.
- **Yes:** Existence resolved via `ClientByIdPipe` (per skill convention). Reason: keeps controller and service free of existence checks.
- **Yes:** Seed via `prisma db seed` with upsert on `nro_doc`. Reason: idempotent across re-runs during dev.
- **Yes:** Enums declared as Postgres enums (`EntityType`, `Status`). Reason: DB-level integrity; matches TS union types in `libs/shared-types`.
- **Yes:** Single `DATABASE_URL` env var drives the Prisma datasource in every environment (local, staging, prod). Reason: Prisma reads `env("DATABASE_URL")` at boot; swapping the env value is enough to point at the prod Postgres URL without code changes.
- **No:** Hardcoded connection strings or per-env `schema.prisma` variants. Reason: they drift; env-only config keeps deploys reproducible.
- **Yes:** `.env` gitignored; `.env.example` committed with a local placeholder (`postgresql://user:pass@localhost:5432/eventapp?schema=public`). Prod URL injected by the deploy platform's secret store. Reason: no secrets in repo.
- **Yes:** `PrismaService` uses default `PrismaClient()` constructor (no explicit `datasources.db.url` override). Reason: lets `DATABASE_URL` remain the single source of truth.
- **Yes:** Context7 lookup performed at implementation time for `@nestjs/common`, `class-validator`, `class-transformer`, `@prisma/client`, `prisma`. Reason: skill rule 0; deviations must be justified in code comments.

---

## Risks

| Risk | Mitigation |
| --- | --- |
| Race between `Entity` insert and `Client` insert leaves orphan `entities` row. | Both inserts run inside `prisma.$transaction(async tx => ...)` with `ReadCommitted`. Any error in the callback triggers automatic rollback of both writes. Verified in acceptance criteria by forcing a duplicate `email` mid-flow and asserting `entities` count unchanged. |
| Concurrent create with same `email`/`nro_doc` bypasses service pre-check (TOCTOU) and hits DB. | DB unique indexes are authoritative; catch Prisma `P2002` and map to `ConflictException` as safety net. |
| `email` uniqueness broken by mixed casing if a legacy row slips in uppercase. | DTO transforms to lowercase before persistence; document constraint in seed and future imports. |
| Reads forget to filter `deletedAt IS NULL` in a future endpoint and expose soft-deleted rows. | Composite index `(status, deletedAt)` + convention documented; consider Prisma extension later (out of scope here). |
| `DATABASE_URL` misconfigured in PROD points at wrong DB or missing credentials. | `PrismaService.onModuleInit` calls `$connect`; app fails fast on boot. `.env.example` documents expected format. |
| Migrations run against PROD outside CI cause drift. | Standardize on `prisma migrate deploy` in deploy pipeline (documented in a future infra spec); local devs use `migrate dev` only. |
| Seed script re-run in PROD overwrites real data. | Seed guarded by env check (`NODE_ENV !== 'production'`) and idempotent upsert on `nro_doc`. |

---

## What is **not** in this spec

- Frontend / UI for client management.
- Unit and E2E test suites.
- Authentication module, JWT guard, `@Public()` wiring.
- Restore endpoint for soft-deleted clients.
- Pagination, search, sorting, extra filters.
- `Place` and `Event` modules (share `Entity` base, own specs).
- Audit interceptor persistence.
- Multi-tenant / dynamic Prisma clients.
- Prisma soft-delete middleware / global extension.
- CI/CD migration pipeline (`prisma migrate deploy`).

Each one lands in its own spec if it ever does.
