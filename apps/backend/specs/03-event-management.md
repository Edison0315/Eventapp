# SPEC 03 — Event management (backend CRUD)

> **Status:** Approved
> **Depends on:** SPEC 01 (Prisma setup, `Entity` model, `Status` enum, `PrismaService`, `buildResponse`, global `ValidationPipe`), SPEC 02 (`Place` model, `PlacesModule`)
> **Date:** 2026-07-17
> **Objective:** Exponer CRUD REST completo para `Event` sobre Prisma + PostgreSQL reutilizando patrón `Entity` ← `Event`, con FKs a `Client` (requerido) y `Place` (opcional), validación de rango temporal medio-abierto `[date_start, date_end)`, prohibición de solape por `place_id`, bloqueo de soft-delete de `Client`/`Place` con eventos activos vía `EventDomainService`, filtros combinables por client/place/rango/status, y seed inicial de 5 eventos ES.

---

## Scope

**In:**

- Extend `prisma/schema.prisma` with `Event` model (additive — no touch a `Entity` fuera de back-relation, `Client`, `Place`, enums existentes).
- Prisma model `Event`:
  - `id Int @id` (1-to-1 FK a `Entity.id`, `onDelete: Cascade`)
  - `name String @db.VarChar(150)`
  - `clientId Int @map("client_id")` (FK requerido a `Client.id`, `onDelete: Restrict`)
  - `placeId Int? @map("place_id")` (FK opcional a `Place.id`, `onDelete: Restrict`)
  - `dateStart DateTime @map("date_start")` (UTC)
  - `dateEnd DateTime @map("date_end")` (UTC)
  - `typeEvent String @db.VarChar(150) @map("type_event")`
  - `status Status @default(activo)`
  - `createdAt @map("created_at")`, `updatedAt @map("updated_at")`, `deletedAt DateTime? @map("deleted_at")`
  - Índices: `@@index([status, deletedAt])`, `@@index([clientId])`, `@@index([placeId])`, `@@index([dateStart, dateEnd])`
  - `@@map("events")`
- Migration `npx prisma migrate dev --name add_events` — crea tabla `events` + índices + FKs. `entities`, `clients`, `places` intactos salvo back-relation `event Event?` en `Entity`.
- Módulo NestJS `events` en `src/modules/events/`:
  - `events.module.ts`, `events.controller.ts`, `events.service.ts`
  - `dto/create-event.dto.ts`, `dto/update-event.dto.ts` (`PartialType`), `dto/list-events-query.dto.ts`
  - `pipes/event-by-id/event-by-id.pipe.ts` resuelve `:id` → `Event` activo no borrado.
  - `domain/event-domain.service.ts` con `ensureClientCanBeDeleted(clientId)` y `ensurePlaceCanBeDeleted(placeId)` — tira `ConflictException` si hay eventos activos referenciando.
  - `extensions/event-overlap.extension.ts` — Prisma Client Extension aplicada sobre `event.create` y `event.update` que valida solape por `place_id` con rango medio-abierto.
- Cablear `EventDomainService` en:
  - `ClientsService.softDelete` → 1 línea: `await this.eventDomain.ensureClientCanBeDeleted(client.id)` antes del update.
  - `PlacesService.softDelete` → 1 línea análoga.
  - Ambos services importan `EventsModule` (exporta `EventDomainService`).
- Aplicar `EventOverlapExtension` sobre instancia extendida de `PrismaService` (usada por `EventsService`).
- REST endpoints bajo `/events`:
  - `GET /events?clientId=&placeId=&from=&to=&status=` — lista activos no borrados, filtros AND combinables.
  - `GET /events/:id` — single activo (pipe).
  - `POST /events` — create `Entity(type='event')` + `Event` dentro de `prisma.$transaction` interactiva.
  - `PATCH /events/:id` — update parcial activo.
  - `DELETE /events/:id` — soft-delete: `deletedAt=now()`, `status='inactivo'`.
- DTOs con `class-validator`: fechas ISO 8601 (`@IsISO8601` + `@Type(() => Date)`), validador custom `@IsAfterField('dateStart')` sobre `dateEnd`, validador custom `@IsFutureDate` sobre `dateStart`.
- Pre-check en `EventsService.create`/`update`: existencia y estado activo de `Client` y (si viene) `Place` → `NotFoundException` con mensaje del campo.
- Respuestas envueltas con `buildResponse(...)`; singulares devuelven `data: [event]`.
- Seed `prisma/seed.ts` extendido: 5 eventos ES, fechas futuras entre 2026-08-01 y 2026-12-31, cada uno referenciando client y place del seed existente, cada par `Entity` + `Event` dentro de su propio `$transaction`, idempotente vía upsert por combinación `(name, dateStart)`.
- Registrar `EventsModule` en `AppModule`.

**Out of scope:**

- Frontend / UI para eventos.
- Tests unit + E2E.
- Auth / guards.
- Restore endpoint para eventos soft-deleted.
- Constraint DB `EXCLUDE USING gist` para overlap (aceptado como TOCTOU futuro, documentado en Risks).
- Estados de evento extra (`programado`/`en_curso`/`finalizado`/`cancelado`) — sólo `Status.activo`/`inactivo`.
- Cascada soft-delete Client/Place → eventos (regla es *bloquear*, no cascadear).
- Zonas horarias por evento — todo UTC.
- Validación de horario laboral / calendario / feriados.
- Recurrencia de eventos (RRULE).
- Notificaciones / recordatorios.
- Multi-tenant.
- Paginación, orden custom (default `dateStart asc`).
- Mockeo de datos / smoke-test scripts / pasos manuales de prueba en el plan. El usuario prueba endpoints manualmente.

---

## Data model

### Prisma schema addition (`prisma/schema.prisma`)

Suma `Event` y back-relations en `Entity`, `Client`, `Place`. Enums intactos.

```prisma
model Entity {
  id     Int        @id @default(autoincrement())
  type   EntityType

  client Client?
  place  Place?
  event  Event?   // NEW back-relation

  @@map("entities")
}

model Client {
  // ...campos existentes sin cambios
  events Event[]  // NEW back-relation
}

model Place {
  // ...campos existentes sin cambios
  events Event[]  // NEW back-relation
}

model Event {
  id        Int       @id
  name      String    @db.VarChar(150)
  clientId  Int       @map("client_id")
  placeId   Int?      @map("place_id")
  dateStart DateTime  @map("date_start")
  dateEnd   DateTime  @map("date_end")
  typeEvent String    @db.VarChar(150) @map("type_event")
  status    Status    @default(activo)
  createdAt DateTime  @default(now())    @map("created_at")
  updatedAt DateTime  @updatedAt         @map("updated_at")
  deletedAt DateTime? @map("deleted_at")

  entity Entity @relation(fields: [id],       references: [id], onDelete: Cascade)
  client Client @relation(fields: [clientId], references: [id], onDelete: Restrict)
  place  Place? @relation(fields: [placeId],  references: [id], onDelete: Restrict)

  @@index([status, deletedAt])
  @@index([clientId])
  @@index([placeId])
  @@index([dateStart, dateEnd])
  @@map("events")
}
```

### DTOs

```ts
// dto/create-event.dto.ts
class CreateEventDto {
  @IsString() @Length(2, 150) name: string;

  @IsInt() @Min(1) clientId: number;

  @IsOptional() @IsInt() @Min(1) placeId?: number;

  @IsISO8601() @IsFutureDate() dateStart: string;
  @IsISO8601() @IsAfterField('dateStart') dateEnd: string;

  @IsString() @Length(2, 150) typeEvent: string;
}

// dto/update-event.dto.ts
class UpdateEventDto extends PartialType(CreateEventDto) {}

// dto/list-events-query.dto.ts
class ListEventsQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) clientId?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) placeId?: number;
  @IsOptional() @IsISO8601() from?: string;
  @IsOptional() @IsISO8601() to?: string;
  @IsOptional() @IsIn(['activo', 'inactivo']) status?: Status;
}
```

Validadores custom viven en `src/common/validators/`:
- `IsFutureDate` — verifica que `new Date(value) > new Date()`.
- `IsAfterField('otroCampo')` — verifica `new Date(value) > new Date(obj[otroCampo])`.

### Response contract

Reusa `ServiceResponse<T>` de SPEC 01 — `buildResponse(statusCode, message, data, metaData?)`, `data` siempre array.

### Filtros lista — semántica

`GET /events` combina filtros AND. Reglas:

- `clientId` → `where.clientId = $`.
- `placeId` → `where.placeId = $`.
- `status` → `where.status = $` (default `activo`).
- `deletedAt IS NULL` siempre implícito.
- **Rango temporal (`from` / `to`)** — filtra por overlap con `[from, to)`:
  - Ambos presentes: `dateStart < to AND dateEnd > from` (evento cuyo intervalo intersecta el query).
  - Solo `from`: `dateEnd > from`.
  - Solo `to`: `dateStart < to`.
- Orden default `dateStart asc`.

### Conventions

- Tabla `events`, columnas snake_case en DB (`client_id`, `place_id`, `date_start`, `date_end`, `type_event`, `created_at`, `updated_at`, `deleted_at`).
- `Event.id` mirror de `Entity.id`; creación en `$transaction` interactiva.
- Fechas persistidas UTC (Prisma default). Cliente envía ISO 8601 con TZ.
- Rango temporal medio-abierto `[dateStart, dateEnd)`. `dateEnd === dateStart` inválido (ver validador `IsAfterField`).
- Solape por `placeId`: dos eventos activos no borrados con mismo `placeId` cuyos `[dateStart, dateEnd)` intersecten → `ConflictException`. Eventos sin `placeId` no chequean solape. Client puede solapar consigo mismo (no chequeado).
- Soft-delete: `deletedAt` non-null + `status='inactivo'` juntos. Reads filtran ambos.
- FKs `onDelete: Restrict` a nivel DB — última red. Regla de negocio (bloquear soft-delete de Client/Place con eventos activos) vive en `EventDomainService`; el hard-delete DB no ocurre porque Client/Place hacen soft-delete.
- Seed: 5 eventos ES, fechas 2026-08 → 2026-12, upsert por par único `(name, dateStart)` — no hay unique en DB pero seed asume no-duplicados por combinación.

---

## Implementation plan

1. **Extend `prisma/schema.prisma`.** Agregar back-relations `event Event?` en `Entity`, `events Event[]` en `Client` y `Place`. Agregar model `Event` como en Data model. No tocar enums ni otros campos.
2. **Run migration.** `npx prisma migrate dev --name add_events`. Verificar: tabla `events` creada con todas las columnas + snake_case, índices `(status, deletedAt)`, `(clientId)`, `(placeId)`, `(dateStart, dateEnd)`, FKs `events.id → entities.id ON DELETE CASCADE`, `events.client_id → clients.id ON DELETE RESTRICT`, `events.place_id → places.id ON DELETE RESTRICT`. `clients`, `places`, `entities` sin cambios estructurales.
3. **Regenerar Prisma Client.** `npx prisma generate` (implícito en migrate dev). App typechequea contra `prisma.event`.
4. **Crear validadores custom.** `src/common/validators/is-future-date.validator.ts` y `src/common/validators/is-after-field.validator.ts`. Ambos con `registerDecorator` de `class-validator`. Exportados por `src/common/validators/index.ts`.
5. **Scaffold módulo `events`.** Crear `src/modules/events/{events.module.ts, events.controller.ts, events.service.ts, dto/, pipes/event-by-id/, domain/, extensions/}`. Registrar `EventsModule` en `AppModule`. Controlador con stub. App bootea.
6. **Implementar DTOs.** `CreateEventDto`, `UpdateEventDto` (`PartialType`), `ListEventsQueryDto` según Data model. Aplican validadores custom.
7. **Implementar `EventByIdPipe`.** Parsea id a int, query `prisma.event.findFirst({ where: { id, status: 'activo', deletedAt: null } })`. `NotFoundException('Event not found')` si null.
8. **Implementar `EventDomainService`** en `src/modules/events/domain/event-domain.service.ts`.
   - `constructor(private prisma: PrismaService)`.
   - `async ensureClientCanBeDeleted(clientId: number)` → cuenta eventos con `clientId`, `status='activo'`, `deletedAt: null`. Si `> 0` → `ConflictException('Client has active events, cannot be deleted')`.
   - `async ensurePlaceCanBeDeleted(placeId: number)` → análogo sobre `placeId`.
   - Exportado por `EventsModule.exports`.
9. **Implementar `EventOverlapExtension`** en `src/modules/events/extensions/event-overlap.extension.ts`.
   - `Prisma.defineExtension({ name: 'eventOverlap', query: { event: { create, update } } })`.
   - En `create`: si `args.data.placeId != null`, ejecutar `client.event.findFirst({ where: { placeId, status: 'activo', deletedAt: null, dateStart: { lt: args.data.dateEnd }, dateEnd: { gt: args.data.dateStart } } })`. Si hit → `ConflictException('Event overlaps with existing event at same place')`. Después `return query(args)`.
   - En `update`: resolver id destino, obtener registro actual, combinar `placeId`/`dateStart`/`dateEnd` finales, mismo chequeo excluyendo `id: { not: targetId }`.
10. **Extender `PrismaService`.** Exponer `prisma.$extends(eventOverlapExtension)` como instancia consumida por `EventsService`. Opción: método `getExtendedClient()` o propiedad readonly `extended`. `PrismaService` mismo NO se auto-extiende (romper otros modules). Sólo `EventsService` usa la extendida.
11. **Implementar `EventsService` — reads.**
    - `findAll(query: ListEventsQueryDto): Promise<Event[]>` — construye `where` según semántica de Data model, `orderBy: { dateStart: 'asc' }`. Default `status='activo'`, siempre `deletedAt: null`.
    - `findOneById(id): Promise<Event | null>`.
12. **Implementar `EventsService.create(dto)`.**
    - Pre-check: `client` existe y activo → `NotFoundException('Client not found')` si no.
    - Pre-check: si `placeId`, `place` existe y activo → `NotFoundException('Place not found')`.
    - `extendedPrisma.$transaction(async (tx) => { entity = tx.entity.create({ data: { type: 'event' } }); event = tx.event.create({ data: { id: entity.id, ...dto, dateStart: new Date(dto.dateStart), dateEnd: new Date(dto.dateEnd) } }); return event; }, { isolationLevel: ReadCommitted })`. La extension corre dentro del tx y valida overlap antes del insert.
    - Capturar `P2003` (FK violation) como red externa → `NotFoundException`.
13. **Implementar `EventsService.update(event, dto)`.**
    - Pre-check condicional client/place si vienen en dto.
    - `extendedPrisma.event.update({ where: { id: event.id }, data: { ...dto, ...(dto.dateStart && { dateStart: new Date(dto.dateStart) }), ...(dto.dateEnd && { dateEnd: new Date(dto.dateEnd) }) } })`. Extension valida overlap.
14. **Implementar `EventsService.softDelete(event)`.** `prisma.event.update({ where: { id: event.id }, data: { deletedAt: new Date(), status: 'inactivo' } })`. Sin extension (soft-delete no genera overlap).
15. **Wire `EventsController`.**
    - `GET /events` → `@Query() q: ListEventsQueryDto` → `findAll(q)`, `buildResponse(200, 'ok', list)`.
    - `GET /events/:id` → `@Param('id', EventByIdPipe) event`, `buildResponse(200, 'ok', [event])`.
    - `POST /events` → `create(dto)`, `buildResponse(201, 'created', [event])`.
    - `PATCH /events/:id` → pipe + `update(event, dto)`, `buildResponse(200, 'updated', [event])`.
    - `DELETE /events/:id` → pipe + `softDelete(event)`, `buildResponse(200, 'deleted', [event])`.
    - Cero `try/catch` en controller.
16. **Cablear `EventDomainService` en `ClientsService.softDelete`.** `EventsModule` importado en `ClientsModule`. `ClientsService` inyecta `EventDomainService`. `softDelete` agrega `await this.eventDomain.ensureClientCanBeDeleted(client.id)` como primera línea antes del update. Sin otra lógica agregada al service.
17. **Cablear `EventDomainService` en `PlacesService.softDelete`.** Análogo al paso 16 con `ensurePlaceCanBeDeleted`.
18. **Extender seed `prisma/seed.ts`.** Agregar 5 eventos ES con fechas futuras 2026-08-01 → 2026-12-31, referenciando ids de clients/places del seed existente (resolver por `email` de client y `name` de place). Cada par `Entity` + `Event` en su propio `$transaction`. Upsert por `(name, dateStart)` (findFirst → create si null). Fechas escalonadas para no solapar en mismo place. `NODE_ENV !== 'production'` gate.
19. **Ejecutar seed.** `npx prisma db seed`. Verificar 5 rows en `events`, 5 nuevas rows en `entities` con `type='event'`, ids matcheando, sin solapes.

---

## Acceptance criteria

- [ ] `npx prisma migrate dev --name add_events` corre limpio; tabla `events` existe con todas las columnas snake_case, índices `(status, deletedAt)`, `(clientId)`, `(placeId)`, `(dateStart, dateEnd)`, FKs `events.id → entities.id ON DELETE CASCADE`, `events.client_id → clients.id ON DELETE RESTRICT`, `events.place_id → places.id ON DELETE RESTRICT`.
- [ ] Tablas `clients`, `places`, `entities` sin cambios estructurales tras migration.
- [ ] `npx prisma db seed` inserta exactamente 5 rows en `events` sobre DB limpia y es idempotente en re-run (sin duplicados, sin errores). Seeds de clients y places previos siguen insertando sus rows.
- [ ] App bootea sin errores tras registrar `EventsModule` en `AppModule`.
- [ ] `POST /events` con body válido devuelve HTTP 201 y `ServiceResponse` con `data: [event]`; inserta una row en `entities` (type=`event`) y una en `events` compartiendo `id`.
- [ ] `POST /events` con body inválido (falta `name`, `clientId` inexistente, `dateStart` en pasado, `dateEnd <= dateStart`, `typeEvent` fuera de 2–150 chars, campo desconocido) devuelve HTTP 400.
- [ ] `POST /events` con `clientId` que apunta a client inexistente o inactivo/borrado devuelve HTTP 404 `NotFoundException` nombrando `Client`.
- [ ] `POST /events` con `placeId` inexistente o inactivo/borrado devuelve HTTP 404 nombrando `Place`.
- [ ] `POST /events` con `placeId` y rango temporal que solapa un evento activo existente en mismo place devuelve HTTP 409 `ConflictException`. Rango medio-abierto: evento A `[10:00, 12:00)`, B `[12:00, 14:00)` en mismo place → NO solapa, ambos aceptados. B `[11:59, 13:00)` → SOLAPA, rechazado.
- [ ] `POST /events` sin `placeId` (null) NO chequea overlap (múltiples eventos sin place pueden coexistir en mismo rango).
- [ ] Forzando fallo en insert de `Event` tras insert de `Entity` (ej. solape detectado por extension), `entities` no queda con row huérfana (rollback del tx).
- [ ] `GET /events` sin filtros devuelve sólo rows con `status='activo'` AND `deletedAt IS NULL`, orden `dateStart asc`.
- [ ] `GET /events?clientId=X` filtra por client. `?placeId=Y` por place. `?status=inactivo` cambia default de status.
- [ ] `GET /events?from=2026-09-01&to=2026-10-01` devuelve sólo eventos cuyo `[dateStart, dateEnd)` intersecta `[from, to)`. Evento que termina exacto en `from` → excluido. Evento que empieza exacto en `to` → excluido.
- [ ] `GET /events?clientId=X&placeId=Y&from=...&to=...&status=activo` combina todos en AND.
- [ ] `GET /events/:id` sobre evento activo devuelve HTTP 200 con `data: [event]`.
- [ ] `GET /events/:id` sobre id inexistente, inactivo o soft-deleted devuelve HTTP 404.
- [ ] `PATCH /events/:id` parcial persiste sólo campos enviados; `updatedAt` avanza; campos no enviados intactos.
- [ ] `PATCH /events/:id` que resulta en solape con otro evento activo en mismo place devuelve HTTP 409.
- [ ] `PATCH /events/:id` que cambia `dateStart` a pasado devuelve HTTP 400.
- [ ] `PATCH /events/:id` que cambia `clientId`/`placeId` a id inexistente/inactivo devuelve HTTP 404.
- [ ] `DELETE /events/:id` setea `deletedAt` non-null y `status='inactivo'`; row permanece físicamente en DB.
- [ ] Tras `DELETE`, mismo id desaparece de `GET /events` y devuelve 404 en `GET /events/:id`.
- [ ] `DELETE /clients/:id` sobre client con ≥1 evento activo (`status='activo'` AND `deletedAt IS NULL`) devuelve HTTP 409 `ConflictException`; el client NO queda soft-deleted.
- [ ] `DELETE /clients/:id` sobre client sin eventos activos (o sólo con eventos inactivos/borrados) funciona normal — HTTP 200, `deletedAt` seteado.
- [ ] `DELETE /places/:id` sobre place con ≥1 evento activo devuelve HTTP 409; place NO queda soft-deleted.
- [ ] `DELETE /places/:id` sobre place sin eventos activos funciona normal.
- [ ] `EventsController` contiene cero bloques `try/catch`.
- [ ] Cada respuesta del controller pasa por `buildResponse(...)`.
- [ ] `EventByIdPipe` aplicado en cada `@Param('id', ...)` del `EventsController`.
- [ ] Lógica de validación cross-entity (bloquear delete de Client/Place con eventos activos) NO vive en `ClientsService`/`PlacesService`/`ClientsController`/`PlacesController` — sólo hay una línea de llamada a `EventDomainService.ensure*CanBeDeleted` en cada `softDelete`.
- [ ] `EventOverlapExtension` NO se aplica al `PrismaService` global — sólo a la instancia consumida por `EventsService`. Otros modules (clients, places, seed) usan cliente sin extender.
- [ ] Fechas persistidas UTC; response ISO 8601 con `Z` o offset.

---

## Decisions

- **Yes:** Reusa patrón `Entity` ← child de SPEC 01/02. Razón: `Event` es tercer polimórfico; consistencia total con Client/Place.
- **Yes:** `typeEvent` como `String @db.VarChar(150)` libre, validado `@IsString @Length(2, 150)`. Razón: elección explícita del usuario — flexibilidad sobre integridad.
- **No:** Enum cerrado para `typeEvent` (`boda | corporativo | ...`). Razón: usuario rechazó — evita bloquear casos no anticipados.
- **Yes:** `clientId` requerido (`Int`, no null). Razón: modelado en `event.type.ts` (`client_id: Entity['id']` sin `| null`).
- **Yes:** `placeId` opcional (`Int?`). Razón: modelado en `event.type.ts` (`place_id: Entity['id'] | null`). Eventos sin sede fija permitidos.
- **Yes:** FKs `onDelete: Restrict` a nivel DB. Razón: última red — el cascade cross-módulo lo maneja la regla de negocio, pero DB no debe permitir hard-delete de Client/Place con eventos referenciando.
- **Yes:** Regla "no borrar Client/Place con eventos activos" vive en `EventDomainService` bajo `src/modules/events/domain/`. Razón: elección explícita del usuario — la lógica no está en controller ni service; los services sólo la llaman en 1 línea.
- **No:** Poner la regla en un NestJS Guard sobre `DELETE /clients/:id` y `/places/:id`. Razón: cubriría sólo HTTP, no seed / scripts / futuros callers.
- **No:** Poner la regla en un middleware/extension de Prisma global sobre `client.update`/`place.update`. Razón: usuario pidió patrón DomainService (ejemplo `CategoryDomainService`); Prisma extension queda reservada para overlap.
- **Yes:** `EventOverlapExtension` (Prisma Client Extension) valida solape sobre `event.create` y `event.update`. Razón: cross-cutting a la escritura de events; mantiene service delgado; se aplica sólo a la instancia consumida por `EventsService`.
- **No:** Validar overlap dentro de `EventsService`. Razón: contamina lógica CRUD con reglas transversales.
- **Yes:** Rango temporal medio-abierto `[dateStart, dateEnd)`. Razón: estándar; evento A `[10:00, 12:00)` y B `[12:00, 14:00)` no solapan — semántica intuitiva.
- **Yes:** Solape chequeado sólo cuando `placeId != null`. Razón: eventos sin sede no compiten por recurso físico.
- **No:** Chequear solape por `clientId`. Razón: elección explícita — un mismo client puede tener eventos concurrentes.
- **Yes:** Prohibir `dateStart` en el pasado vía validador custom `@IsFutureDate`. Razón: elección explícita del usuario.
- **Yes:** Validador custom `@IsAfterField('dateStart')` sobre `dateEnd`. Razón: sin él, `class-validator` no compara campos entre sí; regla de dominio crítica.
- **Yes:** Fechas UTC en DB, ISO 8601 en API. Razón: única fuente de verdad; sin conversiones sorpresa.
- **No:** TZ por evento o por client. Razón: fuera de scope; añade complejidad de conversión sin caso de uso confirmado.
- **Yes:** Prisma interactive transaction (`$transaction(async tx => ...)`) para `Entity` + `Event` insert, `ReadCommitted`. Razón: misma atomicidad que SPEC 01/02.
- **Yes:** Soft-delete via `deletedAt` + `status='inactivo'`. Razón: convención uniforme cross-entities.
- **Yes:** Pre-check existencia+estado de `Client`/`Place` en service antes del insert/update. Razón: `404` accionable con nombre del campo, en vez de `P2003` crudo.
- **Yes:** Filtros `GET /events?clientId=&placeId=&from=&to=&status=` combinables AND. Razón: elección explícita del usuario — caso de uso típico "eventos del cliente X entre fecha A y B".
- **Yes:** Semántica `from`/`to` = overlap con `[from, to)`, no filtro por `dateStart` en rango. Razón: elección explícita — el usuario quiere "eventos que ocurren entre X e Y", no "eventos que empiezan entre X e Y".
- **Yes:** Orden default `dateStart asc`. Razón: agenda natural.
- **No:** `EXCLUDE USING gist (place_id WITH =, tstzrange &&)` a nivel DB. Razón: decisión explícita del usuario — aceptar TOCTOU como bug futuro. Documentado en Risks.
- **No:** Estados extra (`programado`/`en_curso`/`finalizado`/`cancelado`). Razón: usuario mantiene `Status.activo`/`inactivo`; estados de ciclo de vida son otra spec.
- **Yes:** Seed 5 eventos ES con fechas 2026-08 → 2026-12, referenciando clients+places existentes, sin solapes internos, upsert por `(name, dateStart)`. Razón: usuario en Spain; data futura para no tropezar con validador `IsFutureDate`.
- **No:** Data mockeada dinámica / scripts smoke-test / pasos manuales de prueba en el plan. Razón: usuario prueba endpoints manualmente.
- **No:** Auth guard. Razón: no hay auth module; endpoints abiertos como SPEC 01/02.
- **No:** Paginación / búsqueda full-text. Razón: volúmenes bajos, deferred.
- **Yes:** `PrismaService` global NO se auto-extiende; `EventsService` recibe instancia extendida separada. Razón: extension sólo debe correr sobre operaciones de `event.*`; extender el global rompería otros modules innecesariamente y añade overhead.
- **Yes:** Implementación vía agente `/backend-implementer`. Razón: elección explícita del usuario.
- **Yes:** Context7 lookup obligatorio en implementación para `@nestjs/common`, `class-validator`, `class-transformer`, `@prisma/client`, `prisma`. Razón: regla 0 del skill `nestjs-backend-conventions`.

---

## Risks

| Risk | Mitigation |
| --- | --- |
| Race entre insert `Entity` e insert `Event` deja row huérfana en `entities`. | Ambos inserts en `prisma.$transaction(async tx => ...)` con `ReadCommitted`. Error → rollback ambos. Verificado en acceptance forzando solape durante creación. |
| TOCTOU en solape por `placeId`: dos POST concurrentes con rangos solapados pasan chequeo de extension (ambos ven DB limpia) y ambos se insertan. | **Aceptado como bug futuro** por decisión explícita del usuario. Constraint `EXCLUDE USING gist` sobre `tstzrange` está fuera de scope. Cuando aparezca en producción, se sube spec dedicada agregando extensión `btree_gist` + constraint. Mientras: monitorear duplicados manualmente. |
| Extension `EventOverlapExtension` aplicada al `PrismaService` global rompe otros modules o degrada performance. | Extension aplicada sólo a instancia consumida por `EventsService` (via `prisma.$extends(...)`). `ClientsService`, `PlacesService`, seed y otros modules siguen con cliente sin extender. Verificado en acceptance criteria. |
| `EventDomainService.ensureClientCanBeDeleted` no se ejecuta si un futuro caller borra clients por fuera de `ClientsService.softDelete` (ej. script directo a Prisma). | La regla vive en dominio, no en DB. FK `onDelete: Restrict` protege sólo contra hard-delete. Documentar en README del módulo events que cualquier vía nueva de soft-delete de Client/Place debe llamar al DomainService. Alternativa futura: mover a Prisma extension sobre `client.update`/`place.update` cuando `deletedAt` cambia. |
| Regla soft-delete Client/Place → chequeo de eventos genera dependencia circular entre `ClientsModule`/`PlacesModule` y `EventsModule`. | `EventsModule` no depende de Clients/Places (services de events sólo usan ids). `ClientsModule` y `PlacesModule` importan `EventsModule`; `EventsModule` no los importa. Grafo acíclico. Si Prisma pre-checks de existencia en `EventsService.create` requiriesen `ClientsService`/`PlacesService`, se resuelve consultando `prisma.client`/`prisma.place` directo sin importar los modules. |
| `IsFutureDate` evaluado en servidor con reloj desincronizado rechaza eventos legítimos con `dateStart` "ahora mismo". | Validador compara contra `new Date()` en el momento de la request. Tolerar 1s de skew (`new Date(value) >= new Date(Date.now() - 1000)`). Documentar en el validador. |
| Fechas enviadas sin TZ (`2026-09-01T10:00:00` sin `Z` ni offset) interpretadas como local del server. | `@IsISO8601` acepta ambos; DTO fuerza conversión `new Date(value)`. Documentar en README del módulo que el cliente debe enviar TZ explícita. Alternativa: regex adicional exigiendo `Z` o `±HH:MM`. Deferred si no aparece bug real. |
| Filtro `?from=&to=` mal parseado (e.g. `to` < `from`) devuelve resultado incoherente pero no error. | Agregar validación en `ListEventsQueryDto` con validador cruzado `@IsAfterField('from')` sobre `to`. Rechaza con 400. |
| Reads olvidan filtrar `deletedAt IS NULL` en endpoint futuro y exponen soft-deleted. | Índice compuesto `(status, deletedAt)` + convención documentada. `EventByIdPipe` centraliza filtro para `:id`. |
| Migration `add_events` altera accidentalmente `clients`/`places`/`entities` si el diff se edita descuidado. | Migration nombrada `add_events`; PR review debe confirmar SQL generado sólo crea `events` + back-relations en `entities`/`clients`/`places` (add-only). |
| Seed reejecutado en PROD sobrescribe datos reales. | Seed guardado por `NODE_ENV !== 'production'` y upsert idempotente por `(name, dateStart)`. Mismo patrón que SPEC 01/02. |

---

## What is **not** in this spec

- Frontend / UI para eventos.
- Suites de tests unit + E2E.
- Auth module, guards.
- Restore endpoint para eventos soft-deleted.
- Constraint DB `EXCLUDE USING gist` para overlap.
- Estados de evento extra (`programado`/`en_curso`/`finalizado`/`cancelado`).
- Cascada soft-delete Client/Place → eventos.
- TZ por evento / conversiones no-UTC.
- Recurrencia (RRULE), notificaciones, recordatorios.
- Paginación, orden custom, búsqueda full-text.
- Multi-tenant.
- Mockeo de datos / smoke-test scripts.
