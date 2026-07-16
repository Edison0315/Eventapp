# SPEC 02 — Place management (backend CRUD)

> **Status:** Approved
> **Depends on:** SPEC 01 (Prisma setup, `Entity` model, `Status` enum, `PrismaService`, `buildResponse`, global `ValidationPipe`)
> **Date:** 2026-07-16
> **Objective:** Exponer CRUD REST completo para `Place` sobre Prisma + PostgreSQL reutilizando el patrón `Entity` ← `Place` (herencia por composición) con soft-delete, unicidad por `name` y seed inicial de 5 lugares ES.

---

## Scope

**In:**

- Extend `prisma/schema.prisma` with `Place` model (does not touch `Client` or `Entity` — additive only). Enum `EntityType` already includes `place`; reused.
- Prisma model `Place`:
  - `id Int @id` (1-to-1 FK to `Entity.id`, `onDelete: Cascade`)
  - `name String @unique @db.VarChar(120)`
  - `address String @db.VarChar(200)`
  - `ubication String @db.VarChar(300)` (Google Maps URL)
  - `email String @db.VarChar(160)` (stored lowercase, NOT unique)
  - `phone String @db.VarChar(20)`
  - `status Status @default(activo)`
  - `createdAt @map("created_at")`, `updatedAt @map("updated_at")`, `deletedAt DateTime? @map("deleted_at")`
  - `@@index([status, deletedAt])`, `@@map("places")`
- Migration `npx prisma migrate dev --name add_places` — creates `places` table + indexes; leaves `entities`/`clients` untouched.
- NestJS module `places` under `src/modules/places/`:
  - `places.module.ts`, `places.controller.ts`, `places.service.ts`
  - `dto/create-place.dto.ts`, `dto/update-place.dto.ts` (`PartialType`)
  - `pipes/place-by-id/place-by-id.pipe.ts` resolves `:id` → `Place`, filters `status='activo'` AND `deletedAt IS NULL`, throws `NotFoundException` otherwise.
- REST endpoints under `/places`:
  - `GET /places` — list active, non-deleted.
  - `GET /places/:id` — single active (through pipe).
  - `POST /places` — create `Entity(type='place')` + `Place` inside `prisma.$transaction` interactive.
  - `PATCH /places/:id` — partial update on active place.
  - `DELETE /places/:id` — soft-delete: `deletedAt=now()`, `status='inactivo'`.
- DTOs with `class-validator`; `email` normalized to lowercase via `@Transform`.
- Uniqueness pre-check on `name` in service → `ConflictException` with actionable message; catch Prisma `P2002` as safety net.
- Responses wrapped with `buildResponse(...)` (already present); singulars return `data: [entity]`.
- Seed extended: `prisma/seed.ts` adds 5 Spanish places (real ES data: names, addresses, +34 phone numbers, Google Maps URLs), each pair inserted inside its own interactive `$transaction`, idempotent via upsert on `name`.
- Register `PlacesModule` in `AppModule`.

**Out of scope:**

- Frontend / UI for places.
- Unit + E2E tests.
- Auth / guards.
- Restore endpoint for soft-deleted places.
- Pagination, search, sort, extra filters.
- `Event` module.
- Real geospatial validation (parsing Google Maps URL to lat/lng).
- Prisma global soft-delete middleware.
- `Place` ↔ `Client` / `Event` relations.
- Multi-tenant.

---

## Data model

### Prisma schema addition (`prisma/schema.prisma`)

Adds `Place` model. `Entity`, `EntityType`, `Status`, `Client` remain unchanged.

```prisma
model Entity {
  id     Int        @id @default(autoincrement())
  type   EntityType

  client Client?
  place  Place?    // NEW back-relation

  @@map("entities")
}

model Place {
  id        Int       @id
  name      String    @unique @db.VarChar(120)
  address   String    @db.VarChar(200)
  ubication String    @db.VarChar(300)
  email     String    @db.VarChar(160)
  phone     String    @db.VarChar(20)
  status    Status    @default(activo)
  createdAt DateTime  @default(now())    @map("created_at")
  updatedAt DateTime  @updatedAt         @map("updated_at")
  deletedAt DateTime? @map("deleted_at")

  entity    Entity    @relation(fields: [id], references: [id], onDelete: Cascade)

  @@index([status, deletedAt])
  @@map("places")
}
```

### DTOs

```ts
// dto/create-place.dto.ts
class CreatePlaceDto {
  @IsString() @Length(2, 120) name: string;
  @IsString() @Length(1, 200) address: string;
  @IsUrl()    @MaxLength(300) ubication: string;
  @IsEmail() @Transform(({ value }) => value.toLowerCase().trim()) email: string;
  @IsString() @Length(6, 20)  phone: string;
}

// dto/update-place.dto.ts
class UpdatePlaceDto extends PartialType(CreatePlaceDto) {}
```

### Response contract

Reuses `ServiceResponse<T>` from SPEC 01 — `buildResponse(statusCode, message, data, metaData?)` where `data` is always array.

### Conventions

- Table name snake_case (`places`); columns snake_case at DB (`created_at`, `updated_at`, `deleted_at`).
- `Place.id` mirrors `Entity.id` (shared PK); creation inserts `Entity` first, then `Place` with returned id, inside a single `prisma.$transaction(async tx => ...)`.
- `email` normalized to lowercase before persistence (no unique constraint — multiple places may share contact email).
- `name` unique at DB (case-sensitive) — used as natural key for seed upsert.
- `ubication` stored as full Google Maps URL string (`https://maps.google.com/...` or `https://goo.gl/maps/...`); no lat/lng parsing.
- Soft-delete: `deletedAt` non-null + `status='inactivo'` set together. Reads always filter `deletedAt: null` AND `status: 'activo'`.
- Seed data: 5 real ES venues (e.g. Madrid / Barcelona / Valencia), phones `+34 XXX XXX XXX`, valid Google Maps URLs.

---

## Implementation plan

1. **Extend `prisma/schema.prisma`.** Add `place Place?` back-relation on `Entity`. Add `Place` model as defined in Data model. Do not modify `Client`, `Status`, `EntityType`.
2. **Run migration.** `npx prisma migrate dev --name add_places`. Verify: `places` table exists with all columns, unique index on `name`, composite index on `(status, deletedAt)`, FK `places.id → entities.id ON DELETE CASCADE`. `clients` untouched.
3. **Regenerate Prisma Client.** `npx prisma generate` (implicit in migrate dev). App must typecheck against new `prisma.place` delegate.
4. **Scaffold `places` module.** Create `src/modules/places/{places.module.ts, places.controller.ts, places.service.ts, dto/, pipes/place-by-id/}`. Register `PlacesModule` in `AppModule`. Empty controller returning stub. App boots.
5. **Implement DTOs.** `CreatePlaceDto` + `UpdatePlaceDto` (`PartialType`) as in Data model. Rely on global `ValidationPipe` from SPEC 01.
6. **Implement `PlaceByIdPipe`.** `PipeTransform<string, Promise<Place>>`. Parses id to int, queries `prisma.place.findFirst({ where: { id, status: 'activo', deletedAt: null } })`. Throws `NotFoundException('Place not found')` if null.
7. **Implement `PlacesService` — reads.**
   - `findAllActive(): Promise<Place[]>` → `findMany({ where: { status: 'activo', deletedAt: null }, orderBy: { id: 'asc' } })`.
   - `findOneById(id): Promise<Place | null>`.
8. **Implement `PlacesService.create(dto)` — atomic two-table insert.**
   - Normalize `email` lowercase (DTO transform already does it; defensive here too).
   - Pre-check uniqueness on `name` → `ConflictException` before opening tx.
   - Open interactive transaction: `prisma.$transaction(async (tx) => { ... }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted })`:
     1. `const entity = await tx.entity.create({ data: { type: 'place' } });`
     2. `const place = await tx.place.create({ data: { id: entity.id, ...dto, status: 'activo' } });`
     3. `return place;`
   - Any failure → automatic rollback of both writes. No orphan `entities` row possible.
   - Catch `P2002` outside tx and map to `ConflictException` naming the offending field.
9. **Implement `PlacesService.update(place, dto)`.** Receives entity from pipe. Normalize `email` if present. If `name` in dto, pre-check uniqueness excluding own id. `prisma.place.update({ where: { id: place.id }, data: dto })`. Return updated.
10. **Implement `PlacesService.softDelete(place)`.** `prisma.place.update({ where: { id: place.id }, data: { deletedAt: new Date(), status: 'inactivo' } })`. Return updated.
11. **Wire `PlacesController`.**
    - `GET /places` → `findAllActive`, wrap `buildResponse(200, 'ok', list)`.
    - `GET /places/:id` → `@Param('id', PlaceByIdPipe) place`, wrap `buildResponse(200, 'ok', [place])`.
    - `POST /places` → `create(dto)`, wrap `buildResponse(201, 'created', [place])`.
    - `PATCH /places/:id` → pipe + `update(place, dto)`, wrap `buildResponse(200, 'updated', [place])`.
    - `DELETE /places/:id` → pipe + `softDelete(place)`, wrap `buildResponse(200, 'deleted', [place])`.
    Controller has zero `try/catch`.
12. **Extend seed `prisma/seed.ts`.** Add 5 ES places (real Spanish venues, `+34` phones, valid Google Maps URLs). Each `Entity` + `Place` pair inside its own `$transaction`. Idempotent via upsert on `Place.name`. Keep existing client seed untouched. Guarded by `NODE_ENV !== 'production'`.
13. **Run seed.** `npx prisma db seed`. Verify 5 rows in `places`, 5 new rows in `entities` with `type='place'`, ids matching between tables.

---

## Acceptance criteria

- [ ] `npx prisma migrate dev --name add_places` runs clean; `places` table exists with all columns, unique index on `name`, composite index on `(status, deletedAt)`, FK `places.id → entities.id ON DELETE CASCADE`.
- [ ] `clients` and `entities` tables are unchanged after migration (no dropped/renamed columns).
- [ ] `npx prisma db seed` inserts exactly 5 place rows on a clean DB and is idempotent on re-run (no duplicates, no errors); existing client seed still inserts its 3 rows.
- [ ] App boots without errors after `PlacesModule` registration.
- [ ] `POST /places` with valid body returns HTTP 201 and `ServiceResponse` with `data: [place]`; inserts one row in `entities` (type=`place`) and one in `places` sharing the same `id`.
- [ ] `POST /places` with invalid body (missing `name`, malformed `email`, malformed `ubication` URL, `phone` outside 6–20 chars, extra unknown field) returns HTTP 400 from global `ValidationPipe`.
- [ ] `POST /places` with duplicate `name` returns HTTP 409 `ConflictException` naming the `name` field.
- [ ] Forcing a failure on the second insert (retry `POST /places` with a duplicate `name` after DB pre-check bypass) rolls back the first insert: `entities` row count is unchanged after the failed request.
- [ ] `GET /places` returns only rows where `status='activo'` AND `deletedAt IS NULL`.
- [ ] `GET /places/:id` on active place returns HTTP 200 with `data: [place]` (single-element array).
- [ ] `GET /places/:id` on non-existent, inactive, or soft-deleted id returns HTTP 404.
- [ ] `PATCH /places/:id` partial update persists only sent fields; unaffected fields remain unchanged; `updatedAt` advances.
- [ ] `PATCH /places/:id` rejects updates that would violate unique `name` against another place (HTTP 409).
- [ ] `DELETE /places/:id` sets `deletedAt` to non-null and `status='inactivo'`; the row remains physically in DB.
- [ ] After `DELETE`, the same id disappears from `GET /places` and returns 404 on `GET /places/:id`.
- [ ] `PlacesController` file contains zero `try/catch` blocks.
- [ ] Every controller response goes through `buildResponse(...)`.
- [ ] `PlaceByIdPipe` is applied on every `@Param('id', ...)` in `PlacesController`.
- [ ] `email` is stored lowercase regardless of input casing; duplicate emails across places are allowed.
- [ ] `ubication` accepts Google Maps URLs (`https://maps.google.com/...`, `https://goo.gl/maps/...`, `https://www.google.com/maps/...`) and rejects non-URL strings.

---

## Decisions

- **Yes:** Reuse `Entity` ← child pattern from SPEC 01. Reason: `Place` shares the `Entity` polymorphic contract; keeps `entities.type` authoritative and scales to `Event` later.
- **Yes:** `name` is the sole unique constraint. Reason: user explicit choice — natural key for venues, enables idempotent seed upsert.
- **No:** `email` unique. Reason: multiple places may share the same contact email (chain venues, franchises); not a business identity field for `Place`.
- **No:** `phone` unique. Reason: same rationale as `email`; also user may not have phone at creation time in future flows.
- **Yes:** `phone` validated as free string `@IsString @Length(6, 20)`. Reason: user explicit choice — avoids brittle regex; DB caps at `VARCHAR(20)` as safety.
- **No:** `@IsPhoneNumber('ES')` or E.164 regex. Reason: user rejected strict format; keeps seed and manual entry flexible.
- **Yes:** `ubication` typed as Google Maps URL string, validated with `@IsUrl @MaxLength(300)`. Reason: user explicit — stores share links (`maps.google.com`, `goo.gl/maps`, `google.com/maps/place/...`).
- **No:** Parse `ubication` into lat/lng columns. Reason: out of scope; no geospatial queries needed yet.
- **No:** Separate `latitude`/`longitude` columns. Reason: user asked for Google Maps-style field, not coordinates.
- **Yes:** Prisma interactive transaction (`$transaction(async tx => ...)`) with `ReadCommitted` isolation for `Entity` + `Place` insert. Reason: same atomicity guarantee as SPEC 01 — both rows commit together or neither.
- **No:** Batch transaction `$transaction([...])`. Reason: `Place.id` depends on `Entity.id` from step 1; batch form cannot read intermediate results.
- **Yes:** Soft-delete via `deletedAt` + `status='inactivo'` set together. Reason: same convention as `Client`; consistent semantics across entities.
- **Yes:** Pre-check `name` uniqueness in service before insert/update. Reason: friendly `409 Conflict` with actionable message instead of raw Prisma `P2002`.
- **Yes:** Catch `P2002` as safety net for TOCTOU races. Reason: DB unique index is authoritative.
- **Yes:** `email` normalized to lowercase via DTO `@Transform`. Reason: consistency with `Client` even though not unique — future search/dedupe stays sane.
- **Yes:** Seed 5 places with real ES data (Madrid / Barcelona / Valencia / …), `+34` phones, valid Google Maps URLs, upsert by `name`. Reason: user in Spain — sample data must be ES locale, not AR. Idempotent for dev workflow.
- **No:** Argentinian sample data (as in SPEC 01). Reason: user location correction.
- **Yes:** Additive migration (`add_places`) that leaves `clients` and `entities` untouched. Reason: no schema drift; SPEC 01 already shipped.
- **Yes:** Reuse existing `PrismaService`, `buildResponse`, global `ValidationPipe`, `ServiceResponse` interface from SPEC 01. Reason: single source of truth for cross-cutting concerns.
- **No:** New response wrapper or module-scoped Prisma instance. Reason: DRY.
- **No:** Manual smoke-test steps in the implementation plan. Reason: user tests endpoints manually themselves.
- **No:** Auth guard wiring. Reason: no auth module yet; endpoints stay open — will land in its own spec (same as SPEC 01).
- **No:** Pagination, search, sort, extra filters. Reason: deferred, volumes low.
- **Yes:** Context7 lookup required at implementation time for `@nestjs/common`, `class-validator`, `class-transformer`, `@prisma/client`, `prisma`. Reason: rule 0 of `nestjs-backend-conventions` skill.

---

## Risks

| Risk | Mitigation |
| --- | --- |
| Race between `Entity` insert and `Place` insert leaves orphan `entities` row. | Both inserts run inside `prisma.$transaction(async tx => ...)` with `ReadCommitted`. Any error triggers automatic rollback of both writes. Verified in acceptance criteria by forcing a duplicate `name` mid-flow and asserting `entities` count unchanged. |
| Concurrent create with same `name` bypasses service pre-check (TOCTOU) and hits DB. | DB unique index on `places.name` is authoritative; catch Prisma `P2002` and map to `ConflictException`. |
| `ubication` accepts arbitrary URLs, not necessarily Google Maps. | `@IsUrl` validates URL shape only; document that field is intended for Google Maps share links but no host allowlist enforced (out of scope). Future spec may tighten with host regex. |
| Seed re-run in PROD overwrites real data. | Seed guarded by `NODE_ENV !== 'production'` and idempotent upsert on `Place.name`. Same guard as SPEC 01. |
| Reads forget to filter `deletedAt IS NULL` in a future endpoint and expose soft-deleted rows. | Composite index `(status, deletedAt)` + convention documented; `PlaceByIdPipe` centralizes the filter for `:id` routes. |
| Migration `add_places` accidentally alters `clients` if schema edited carelessly. | Migration name scoped `add_places`; PR review must confirm generated SQL only touches `places` + `entities` back-relation (no destructive ops on `clients`). |

---

## What is **not** in this spec

- Frontend / UI for place management.
- Unit and E2E test suites.
- Auth module, guards.
- Restore endpoint for soft-deleted places.
- Pagination, search, sorting, extra filters.
- `Event` module.
- Geospatial parsing / lat-lng columns.
- `Place` ↔ `Client` / `Event` relations.
- Multi-tenant.
- Prisma soft-delete global middleware.
