# SPEC 01 — Client management (frontend CRUD)

> **Status:** Draft
> **Depends on:** Backend SPEC 01 — Client management (endpoints `/clients` live).
> **Date:** 2026-07-17
> **Objective:** Deliver frontend CRUD for `Client` under `admin/clients` consuming `/clients` with a filterable list, reactive form inside a side drawer and delete confirmation, using Fuse Angular signals-first.

---

## Scope

**In:**

- New feature module at `src/app/modules/admin/clients/` (standalone components, OnPush, signals-first).
- Files:
  - `clients.routes.ts` — lazy routes wiring list + drawer edit/create children.
  - `clients.component.ts/.html` — list page container (mat-table + side drawer host via `MatDrawerContainer`).
  - `clients-list/clients-list.component.ts/.html` — table with columns `name`, `nro_doc`, `email`, `ubication`, `status`, actions; default sort `name` asc; text search input.
  - `clients-form/clients-form.component.ts/.html` — reactive form used for both create and edit inside the drawer.
  - `clients.service.ts` — HTTP client wrapping `/clients` endpoints, unwraps `ServiceResponse<Client>.data` manually per method.
  - `clients.store.ts` — signals-first store (`#clients`, `#loading`, `#error`, `#saving`) with `asReadonly()` public surface; exposes `load`, `create`, `update`, `remove`, `byId`.
- Route registration: `path: 'clients', loadChildren: () => import('./clients/clients.routes')` inside admin routing.
- Navigation item under Fuse nav data (`src/app/core/navigation/data.ts` or equivalent) with `title: 'Clients'`, `icon: 'heroicons_outline:user-group'`, `link: '/admin/clients'`.
- Environment: add `apiUrl: 'http://localhost:3000'` to `src/environments/environment.ts` (+ `environment.prod.ts` with prod placeholder). `ClientsService` composes URLs as `${environment.apiUrl}/clients`.
- Client-side search: `computed()` filter over store `clients()` matching case-insensitive substring on `name`, `nro_doc`, `email`.
- Reactive form validators mirroring backend DTO:
  - `name`: required, minLength 2, maxLength 120.
  - `nro_doc`: required, maxLength 40.
  - `address`: required, maxLength 200.
  - `ubication`: required, maxLength 200.
  - `email`: required, `Validators.email`, maxLength 160.
  - `web`: optional, URL pattern, maxLength 200.
- Delete flow uses `FuseConfirmationService.open({...})` with confirm/cancel; on confirm calls store `remove(id)`.
- Feedback via `MatSnackBar`:
  - Success: `Client created`, `Client updated`, `Client deleted`.
  - 409 → `Duplicate <field>` (parses backend message to extract offending field).
  - 400 → validation summary from backend.
  - Other → `Unexpected error, try again`.
- View states:
  - Loading: `<fuse-loading-bar />` while `loading()` true.
  - Empty: illustration/text `No clients yet` + CTA button `Create client` when list empty and not loading.
  - Error: `<fuse-alert type="error">` with `Retry` button re-invoking `store.load()`.
  - Form: submit button disabled while form invalid or `saving()` true.
- Texts hardcoded in Spanish/English (project default) — no Transloco keys added in this spec.
- Standalone imports only; no NgModules. Every component `changeDetection: OnPush`, `standalone: true`.

**Out of scope (future specs):**

- Pagination, server-side sort/filter (backend does not paginate yet).
- Transloco i18n keys for clients feature.
- Unit / component / e2e tests.
- Restore endpoint for soft-deleted clients.
- Auth guard / role checks (no auth module yet).
- Bulk actions (multi-select delete, CSV import/export).
- Mock API handlers under `@fuse/lib/mock-api` — real backend is used.
- Optimistic updates; every mutation waits for backend response before mutating store.
- Global HTTP error interceptor (per-service handling for now).
- Places and Events frontend modules (own specs).

---

## Data model

Frontend introduces no new persisted entities. It reuses the shared `Client` type:

```ts
// libs/shared-types/src/entities/client.type.ts (existing)
interface Client extends Entity {
  name: string;
  nro_doc: string;
  address: string;
  ubication: string;
  email: string;
  web: string | null;
  status: Status;      // 'activo' | 'inactivo'
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}
```

### Backend response envelope (consumed, not defined here)

```ts
interface ServiceResponse<T> {
  statusCode: number;
  message: string;
  data: T[];
  metaData?: Record<string, unknown>;
}
```

`ClientsService` unwraps `data` per method — returns `Client[]` for list, `Client` for single-item endpoints (`data[0]`).

### Store state shape

```ts
// clients.store.ts
readonly #clients = signal<ReadonlyArray<Client>>([]);
readonly #loading = signal(false);
readonly #saving  = signal(false);
readonly #error   = signal<Error | null>(null);

readonly clients = this.#clients.asReadonly();
readonly loading = this.#loading.asReadonly();
readonly saving  = this.#saving.asReadonly();
readonly error   = this.#error.asReadonly();
readonly byId    = (id: number) => computed(() => this.#clients().find(c => c.id === id));
```

### Form model

```ts
// clients-form.component.ts
readonly form = this.fb.nonNullable.group({
  name:      ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
  nro_doc:   ['', [Validators.required, Validators.maxLength(40)]],
  address:   ['', [Validators.required, Validators.maxLength(200)]],
  ubication: ['', [Validators.required, Validators.maxLength(200)]],
  email:     ['', [Validators.required, Validators.email, Validators.maxLength(160)]],
  web:       ['', [Validators.pattern(/^https?:\/\/.+/), Validators.maxLength(200)]],
});
```

Payload sent to backend matches `CreateClientDto` / `UpdateClientDto` shape (no `id`, no timestamps, no `status`). Empty `web` string is transformed to `null` before send.

### Search filter (computed)

```ts
readonly search = signal('');
readonly visibleClients = computed(() => {
  const q = this.search().trim().toLowerCase();
  const list = this.store.clients();
  if (!q) return list;
  return list.filter(c =>
    c.name.toLowerCase().includes(q) ||
    c.nro_doc.toLowerCase().includes(q) ||
    c.email.toLowerCase().includes(q),
  );
});
```

### Environment additions

```ts
// src/environments/environment.ts
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000',
};
```

`environment.prod.ts` mirrors with real URL placeholder.

---

## Implementation plan

1. **Environment scaffolding.** Add `apiUrl` to `src/environments/environment.ts` and `environment.prod.ts`. Verify `ng build` still succeeds.
2. **Shared types import path.** Confirm alias to `libs/shared-types` resolves in `apps/frontend/tsconfig.json`; if missing, add path mapping (e.g. `"@shared-types/*": ["../../libs/shared-types/src/*"]`) at monorepo root `tsconfig.base.json` per skill rule 0.1.
3. **Feature folder skeleton.** Create `src/app/modules/admin/clients/` with empty stubs: `clients.routes.ts`, `clients.component.ts/.html`, `clients-list/clients-list.component.ts/.html`, `clients-form/clients-form.component.ts/.html`, `clients.service.ts`, `clients.store.ts`. All components standalone + OnPush.
4. **Route wiring.** Register lazy path `clients` in admin routing (`src/app/app.routes.ts` or admin child routes) → `loadChildren: () => import('./modules/admin/clients/clients.routes').then(m => m.default)`. Children: `''` → list, `new` → form (create), `:id` → form (edit).
5. **Navigation entry.** Add nav item to Fuse navigation data source (`src/app/core/navigation/data.ts` or `mock-api/common/navigation/data.ts` depending on where nav lives) with `id: 'admin.clients'`, `title: 'Clients'`, `type: 'basic'`, `icon: 'heroicons_outline:user-group'`, `link: '/admin/clients'`.
6. **`ClientsService`.** Inject `HttpClient`. Methods:
   - `list(): Promise<Client[]>` → `firstValueFrom(http.get<ServiceResponse<Client>>(`${apiUrl}/clients`))` → `res.data`.
   - `get(id): Promise<Client>` → same pattern, returns `res.data[0]`.
   - `create(dto): Promise<Client>` → `POST /clients`, returns `res.data[0]`.
   - `update(id, dto): Promise<Client>` → `PATCH /clients/:id`, returns `res.data[0]`.
   - `remove(id): Promise<Client>` → `DELETE /clients/:id`, returns `res.data[0]`.
   Payloads strip `web: ''` → `null`.
7. **`ClientsStore`.** `@Injectable({ providedIn: 'root' })`. Private signals + readonly surface as per Data model. Methods:
   - `async load()` — set loading, call `service.list()`, set `#clients`, handle error into `#error`, clear loading in finally.
   - `async create(dto)` — set `#saving`, on success push to `#clients`, return created; propagate error for caller (component) to snack-bar.
   - `async update(id, dto)` — set `#saving`, replace item in `#clients` on success.
   - `async remove(id)` — set `#saving`, drop item from `#clients` on success.
   - `byId(id)` computed helper.
   Any failure resets `#saving` in finally; caller receives error to display snack.
8. **List component (`clients-list`).** Inject store. Injects `MatDrawer` from parent via `input()`? — instead, list emits `output<'create' | Client>()` events; parent (`ClientsComponent`) opens drawer with proper mode. Table: `mat-table` with columns above; sort via `matSort`, default `name` asc. Search input bound to `search` signal (2-way with `model()` or manual `(input)` handler). `visibleClients` computed feeds `[dataSource]`. Empty state: `@if (!store.loading() && visibleClients().length === 0)` block. Error state: `@if (store.error(); as err)` shows `fuse-alert` + retry button. Loading: `<fuse-loading-bar/>` visible while `store.loading()`. Row actions: edit button emits row, delete button opens `FuseConfirmationService`; on confirm calls `store.remove(row.id)` and shows snack.
9. **Form component (`clients-form`).** Inputs: `mode = input<'create'|'edit'>()`, `clientId = input<number|null>(null)`. Reactive form as in Data model. In `constructor` `effect` — when `mode()==='edit'` and `clientId()` set, load current client via `store.byId(id)()` and `form.patchValue(...)`. Submit handler: build payload (`web` empty → null), call `store.create` or `store.update`, then emit `saved` output and let parent close the drawer + show snack. Buttons: Save (disabled while `form.invalid || store.saving()`), Cancel (emits `cancelled`).
10. **Parent container (`ClientsComponent`).** `MatDrawerContainer` with:
    - Main pane hosts `<app-clients-list>` receiving events.
    - Drawer hosts `<app-clients-form>` with signals-based `mode` and `clientId` derived from route child or list events.
    Opens drawer on `create` event or edit click; closes on `saved` / `cancelled`. Alternative wiring via router outlet under drawer if child routes chosen — pick one and document in code comment.
11. **Error → snack mapping.** Small helper `formatError(err: HttpErrorResponse)`:
    - 409 → parse `err.error.message` looking for `nro_doc` or `email`; return `Duplicate <field>`.
    - 400 → join `err.error.message` array if present.
    - Else → `Unexpected error, try again`.
    Used by list (delete) and form (save) after catch.
12. **Initial load.** `ClientsComponent` calls `store.load()` in constructor via `effect` guarded by `runOnceGuard` (or plain call in constructor since store is singleton). Refreshes on navigation back to route only if `#clients()` empty.
13. **Styling.** Tailwind utility classes matching Fuse breakpoints (`sm:`, `md:`, `lg:`). Drawer width `w-full md:w-100`. Table wrapped in `overflow-x-auto` container for narrow screens.
14. **Manual verification (out-of-scope smoke skipped per user preference).** Build + serve via `nx serve frontend`; user validates flow manually.

---

## Acceptance criteria

- [ ] `apps/frontend/src/environments/environment.ts` exports `apiUrl`; production file mirrors it.
- [ ] Route `/admin/clients` renders the list page lazy-loaded.
- [ ] Fuse navigation shows a `Clients` entry with `heroicons_outline:user-group` icon linking to `/admin/clients`.
- [ ] `GET /clients` fires exactly once on entering the route (unless store already populated).
- [ ] Table shows columns `name`, `nro_doc`, `email`, `ubication`, `status`, `actions` and sorts by `name` asc by default.
- [ ] Search input filters visible rows case-insensitively across `name`, `nro_doc`, `email` via a `computed` signal; no HTTP call fires on typing.
- [ ] While `store.loading()` true, `<fuse-loading-bar />` is visible.
- [ ] With empty result set and not loading, empty state shows CTA button `Create client` opening the drawer in create mode.
- [ ] On HTTP error during load, `<fuse-alert type="error">` renders with a `Retry` button that reinvokes `store.load()`.
- [ ] Clicking `Create client` opens the drawer with an empty form.
- [ ] Clicking edit on a row opens the drawer with form pre-filled from `store.byId(id)()`.
- [ ] Submit button is disabled while `form.invalid` OR `store.saving()` is true.
- [ ] Successful create appends the returned `Client` to `store.clients()` and shows snack `Client created`.
- [ ] Successful update replaces the item in `store.clients()` and shows snack `Client updated`.
- [ ] `web` field submitted as empty string is sent as `null` to backend.
- [ ] 409 response on create/update shows snack `Duplicate nro_doc` or `Duplicate email` based on backend message.
- [ ] 400 response shows snack with the validation summary parsed from `err.error.message`.
- [ ] Delete action opens `FuseConfirmationService` dialog; cancel closes without HTTP call; confirm calls `DELETE /clients/:id`.
- [ ] Successful delete removes the row from `store.clients()` and shows snack `Client deleted`.
- [ ] Every new component declares `standalone: true` and `changeDetection: ChangeDetectionStrategy.OnPush`.
- [ ] No component uses `*ngIf`, `*ngFor`, `*ngSwitch`, `async` pipe, `@Input`/`@Output` decorators, `BehaviorSubject`, or `ViewChild` decorators. All templates use `@if / @for (…; track …) / @switch`.
- [ ] `ClientsStore` exposes only readonly signals; no external code mutates state directly.
- [ ] `ClientsService` unwraps `ServiceResponse.data` per method — components/store never see the envelope.
- [ ] No files added under `src/@fuse/`.
- [ ] No new `package.json`, lockfile, or `node_modules/` inside `apps/frontend/`.
- [ ] `nx build frontend` and `nx serve frontend` succeed.

---

## Decisions

- **Yes:** Feature module at `src/app/modules/admin/clients/`. Reason: matches existing `admin/example` layout; nav item lives under admin scope.
- **No:** Root-level `src/app/modules/clients/`. Reason: breaks admin grouping convention.
- **Yes:** Classic Fuse layout — list page + side drawer (`MatDrawerContainer`) hosting reactive form for both create and edit. Reason: canonical Fuse pattern, minimal routing, keeps context visible while editing.
- **No:** Separate route `/clients/:id` for detail page. Reason: extra navigation friction for a simple CRUD.
- **No:** Modal dialog for edit. Reason: worse UX on small screens vs drawer.
- **Yes:** `apiUrl` in `src/environments/environment.ts`; service composes URL manually. Reason: explicit, no global interceptor complexity.
- **No:** Base-URL HTTP interceptor. Reason: single feature consuming the API today; interceptor can land later without breaking API.
- **Yes:** `ClientsService` unwraps `ServiceResponse.data` per method. Reason: explicit contract at boundary, no hidden magic; store/components consume plain `Client` shapes.
- **No:** Global response-unwrap interceptor. Reason: interceptor cannot know when to return `T` vs `T[]`; per-method unwrap is cleaner.
- **Yes:** Signals-first `ClientsStore` (`#clients`, `#loading`, `#saving`, `#error`) with `asReadonly()` public surface. Reason: canonical pattern from `fuse-angular` skill; enables cached list + client-side search via `computed`.
- **No:** `rxResource` directly in list component without store. Reason: mutations (create/update/delete) need shared cache access; store centralizes it.
- **Yes:** Client-side text search via `computed()` over `store.clients()`. Reason: backend does not paginate; dataset small; instant UX.
- **No:** Server-side search endpoint. Reason: backend does not support it in current spec.
- **Yes:** Reactive Forms with validators mirroring backend DTO (min/max lengths, email, URL pattern). Reason: fail fast in UI; backend remains authoritative on duplicates.
- **Yes:** `FuseConfirmationService` before `DELETE`. Reason: vendor-provided, matches Fuse UX; prevents accidental soft-delete.
- **Yes:** `MatSnackBar` for feedback; small `formatError` helper maps 400/409/other to human messages. Reason: consistent with Angular Material stack already in use.
- **No:** Global HTTP error interceptor for snack. Reason: per-call context matters (which action failed) — component-level handling is clearer.
- **Yes:** Non-optimistic updates — store waits for backend response before mutating. Reason: keeps store as source of truth; avoids rollback complexity on 409.
- **Yes:** Hardcoded strings in current project language. Reason: user deferred i18n; Transloco keys can be introduced later without behavior change.
- **No:** Transloco keys for clients feature in this spec. Reason: user deferred to future spec.
- **No:** `@fuse/lib/mock-api` handlers for `/clients`. Reason: real backend is available; avoids double source of truth.
- **No:** Unit / component / e2e tests. Reason: user aligned with backend spec 01 pattern (tests deferred).
- **Yes:** All components `standalone: true` + `ChangeDetectionStrategy.OnPush`. Reason: skill hard rule.
- **Yes:** Templates use new control flow only (`@if / @for (…; track …) / @switch`). Reason: skill hard rule.
- **Yes:** Context7 lookup at implementation time for `@angular/core`, `@angular/forms`, `@angular/material`, `@angular/cdk`, `@fuse/services/confirmation`. Reason: skill rule 0.

---

## Risks

| Risk | Mitigation |
| --- | --- |
| Backend `ServiceResponse` envelope shape drifts (e.g. `data` becomes single object instead of array). | Unwrap centralized in `ClientsService` per method; a shape change breaks in one place with a clear TS error, not silently across components. |
| CORS blocks `http://localhost:3000` from `ng serve` origin. | Backend must enable CORS for dev origin; if missing, document `app.enableCors()` requirement and fail fast with a snack `Cannot reach API`. |
| `apiUrl` shipped as `http://localhost:3000` into production build. | `environment.prod.ts` carries a real placeholder URL; deploy pipeline swaps it. Add TODO comment on the prod file so it is not forgotten. |
| Stale store cache after external mutation (another tab creates a client). | Provide a `Refresh` button in list header calling `store.load()`; deferred auto-poll to a later spec. |
| 409 backend message format changes and `formatError` mis-parses field name. | Fallback branch returns generic `Duplicate value`; log raw message to console for debugging. |
| Users double-click Save producing duplicate POSTs. | Submit button disabled while `store.saving()` true; store enters saving state before HTTP call. |
| Deep-link to `/admin/clients/:id` (edit) before store loaded → `byId` returns undefined. | Form component awaits store `loading()` false; if still not found after load, closes drawer and shows snack `Client not found`. |
| Search filter recomputes on every keystroke for large lists. | `computed()` is memoized by signal identity; acceptable for current dataset size. Revisit if list grows beyond ~1k rows. |
