---
name: fuse-angular
description: Conventions for the Fuse Angular (standalone) frontend. Auto-activate when a frontend subagent works under <FRONTEND_ROOT> or edits *.ts / *.html / *.scss files inside that path. Do NOT activate for backend, infra, or sibling packages. Enforces signals-first Angular 19+, standalone components with OnPush, new control flow, RxJS only at boundaries, and the Fuse config/nav/mock-api/theming contracts.
---

# Fuse Angular — Skill

## 0. Integration in a monorepo (READ FIRST)

This skill is portable. Before use, set the placeholder below to the actual path
of the Fuse frontend inside your monorepo, then commit the edit:

```
<FRONTEND_ROOT> = apps/frontend
```

Every path in this file is relative to `<FRONTEND_ROOT>`. Never introduce
absolute paths. If a rule references `<FRONTEND_ROOT>/src/@fuse/...`, resolve
it against the value you set above.

Activation scope (enforced by the `description` frontmatter): only when the
subagent is operating on files under `<FRONTEND_ROOT>`. Backend, infra, and
other packages are out of scope for this skill.

### 0.1 Dependencies live one scope UP — not inside `<FRONTEND_ROOT>`

This frontend is an Nx-managed app. **Node dependencies are NOT managed at
`<FRONTEND_ROOT>` scope.** There is a single root `package.json` (and single
lockfile) at the monorepo root that owns every dep for every workspace,
including this Angular app.

Reference `project.json` at `<FRONTEND_ROOT>/project.json` looks like:

```json
{
  "name": "frontend",
  "$schema": "../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "apps/frontend/src",
  "projectType": "application",
  "targets": {
    "build": {
      "executor": "nx:run-commands",
      "options": { "command": "ng build", "cwd": "apps/frontend" }
    },
    "serve": {
      "executor": "nx:run-commands",
      "options": { "command": "ng serve", "cwd": "apps/frontend" }
    }
  }
}
```

Signals from that file:

- `../../node_modules/...` in the `$schema` path proves `node_modules/` is
  resolved from the **monorepo root**, two levels up.
- Targets run `ng build` / `ng serve` with `cwd: apps/frontend`, so the
  Angular CLI runs *inside* `<FRONTEND_ROOT>` but its toolchain (Nx, Angular
  CLI, TypeScript, Tailwind, etc.) is installed at the root.

**Rules — enforce hard:**

1. **Do not create `<FRONTEND_ROOT>/package.json`.** If one exists in this
   template repo (Fuse ships with one), delete it during monorepo
   integration and fold its deps into the root `package.json`.
2. **Do not create `<FRONTEND_ROOT>/package-lock.json` /
   `pnpm-lock.yaml` / `yarn.lock`.** One lockfile at monorepo root.
3. **Do not run `npm install`, `pnpm add`, `yarn add` from
   `<FRONTEND_ROOT>`.** Run the equivalent at the monorepo root. When
   suggesting a command, prefix with `cd <MONOREPO_ROOT>` or use the
   package manager's `-w` / `--filter` flag, never `cd <FRONTEND_ROOT>`.
4. **Do not add dep-version pins inside `<FRONTEND_ROOT>`** (no
   `.npmrc` override, no `resolutions`, no `overrides`). Version policy is
   a root concern.
5. **Angular / Fuse upgrades:** bump every `@angular/*`, `@angular/cdk`,
   `@angular/material`, `@angular/material-luxon-adapter`, `zone.js`,
   `rxjs`, `typescript` and the Tailwind chain together in the root
   `package.json`. Angular refuses mismatched majors.
6. **`node_modules/` is never inside `<FRONTEND_ROOT>`.** If a script or
   import assumes a local `node_modules/`, fix the script — do not install
   locally to satisfy it.
7. **Scripts (`ng`, `ng build`, `ng serve`, `ng test`) are invoked via Nx
   targets**, not via a `<FRONTEND_ROOT>/package.json` `scripts` block.
   Add or edit targets in `<FRONTEND_ROOT>/project.json`. Wire developer
   ergonomics (e.g. `nx serve frontend`) at the root.
8. **Path aliases** (`@fuse/*`, `app/*`) stay in
   `<FRONTEND_ROOT>/tsconfig.json`. If the root `tsconfig.base.json`
   defines workspace-wide aliases, extend it — never duplicate.

When in doubt: if the change touches *what is installed*, it belongs at the
monorepo root. If the change touches *how this app builds or serves*, it
belongs in `<FRONTEND_ROOT>/project.json` or Angular config files.

---

## 1. Expected tree under `<FRONTEND_ROOT>` — what to touch

```
<FRONTEND_ROOT>/
├── angular.json
├── project.json               ← Nx target defs (build/serve/test)
├── tailwind.config.js
├── tsconfig*.json             ← extends monorepo root tsconfig.base.json
└── src/
    ├── @fuse/                  ← VENDOR. DO NOT EDIT.
    │   ├── components/         (navigation, drawer, alert, card, ...)
    │   ├── directives/         (scrollbar, scroll-reset)
    │   ├── lib/mock-api/       (interceptor + handler registry)
    │   ├── services/           (config, media-watcher, loading,
    │   │                       splash-screen, confirmation, platform,
    │   │                       utils)
    │   ├── styles/  tailwind/  animations/  pipes/  validators/
    │   └── fuse.provider.ts    (provideFuse)
    ├── app/
    │   ├── app.config.ts       (root providers — provideFuse call)
    │   ├── app.routes.ts
    │   ├── core/               (auth, icons, navigation, transloco, user)
    │   ├── layout/             (chosen Fuse layout wiring — edit freely)
    │   ├── mock-api/           (project-owned mock endpoints)
    │   └── modules/            (feature code — main work happens here)
    ├── environments/
    └── styles/
```

Rules:

- **`src/@fuse/**` is vendor**. Never modify. If you need different behavior,
  wrap or extend it inside `src/app/`. A PR that changes `@fuse/` is rejected.
- Feature work belongs in `src/app/modules/<feature>/`.
- Cross-cutting concerns (auth guards, HTTP interceptors, domain services)
  belong in `src/app/core/`.
- Layout customization (header slots, nav data) belongs in `src/app/layout/`,
  never inside `@fuse/components/navigation`.
- Path aliases: `@fuse/*` and `app/*` are configured in `tsconfig.json`.
  Use them. Never use deep relative `../../../` climbs across those roots.

---

## 2. Signals-first — HARD RULE

All state, inputs, outputs, view/content queries and derivations use signals
unless a technical impossibility is documented in a code comment on the
declaring line, e.g.:

```ts
// signals-exception: third-party lib emits raw Observable of infinite stream
// and lifecycle requires manual retry — keeping RxJS pipeline end-to-end.
```

**No signals-exception comment ⇒ the code is wrong. Reject it.**

### 2.1 Pattern migration table

| Old / forbidden                          | Signals-first replacement                            |
|------------------------------------------|------------------------------------------------------|
| `@Input() name!: string;`                | `readonly name = input.required<string>();`         |
| `@Input() label = '';`                   | `readonly label = input('');`                        |
| `@Output() saved = new EventEmitter();`  | `readonly saved = output<void>();`                   |
| `@ViewChild(X) x!: X;`                   | `readonly x = viewChild.required(X);`                |
| `@ViewChildren(X) xs!: QueryList<X>;`    | `readonly xs = viewChildren(X);`                     |
| `@ContentChild(X) c!: X;`                | `readonly c = contentChild.required(X);`             |
| `foo$: Observable<T>` + `\| async`       | `readonly foo = toSignal(foo$, { initialValue })`    |
| `BehaviorSubject<T>` for local/state svc | `#foo = signal<T>(init); readonly foo = this.#foo.asReadonly();` |
| `combineLatest([...]).pipe(map)`         | `computed(() => f(a(), b()))`                        |
| `ngOnDestroy` + `takeUntil(unsub$)`      | `takeUntilDestroyed()` at effect/subscription site   |
| HTTP `service.get$()` + subscribe        | `rxResource({ params, stream })` in component        |
| `*ngIf` / `*ngFor` / `*ngSwitch`         | `@if` / `@for (…; track x.id)` / `@switch`           |
| `NgModule`                               | `standalone: true` (already the default in v19)      |

RxJS is allowed **only at edges**: `HttpClient`, `WebSocket`, DOM event
streams, third-party observables. Convert to a signal with `toSignal` as
early as possible. Use `toObservable` only when a specific RxJS operator
(debounceTime, switchMap, retry with backoff, etc.) is the right tool and no
signal equivalent exists.

Never use the `async` pipe when the origin can be exposed as a signal.

### 2.2 Component skeleton (canonical)

```ts
import {
  ChangeDetectionStrategy, Component, computed, effect,
  inject, input, output, signal, viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { UserStore } from 'app/core/user/user.store';

@Component({
  selector: 'app-user-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule],
  templateUrl: './user-card.component.html',
})
export class UserCardComponent {
  readonly userId = input.required<string>();
  readonly compact = input(false);
  readonly saved   = output<string>();

  private readonly store = inject(UserStore);

  readonly user      = computed(() => this.store.byId(this.userId()));
  readonly fullName  = computed(() => {
    const u = this.user();
    return u ? `${u.first} ${u.last}` : '';
  });

  readonly saveBtn = viewChild.required<HTMLButtonElement>('saveBtn');

  constructor() {
    effect(() => {
      // Reactive side effect, auto-tears down with the component.
      document.title = this.fullName() || 'User';
    });
  }

  save(): void {
    this.saved.emit(this.userId());
  }
}
```

Template:

```html
@if (user(); as u) {
  <h2>{{ fullName() }}</h2>
  @for (role of u.roles; track role.id) {
    <span class="chip">{{ role.name }}</span>
  } @empty {
    <span>No roles</span>
  }
  <button #saveBtn mat-flat-button (click)="save()">Save</button>
} @else {
  <p>Loading…</p>
}
```

### 2.3 State service (canonical)

```ts
import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class UserStore {
  private readonly http = inject(HttpClient);

  // Private writable state.
  readonly #users   = signal<ReadonlyArray<User>>([]);
  readonly #loading = signal(false);
  readonly #error   = signal<Error | null>(null);

  // Public read-only surface.
  readonly users    = this.#users.asReadonly();
  readonly loading  = this.#loading.asReadonly();
  readonly error    = this.#error.asReadonly();
  readonly byId     = (id: string) =>
    computed(() => this.#users().find(u => u.id === id));

  async load(): Promise<void> {
    this.#loading.set(true);
    this.#error.set(null);
    try {
      const list = await firstValueFrom(this.http.get<User[]>('/api/users'));
      this.#users.set(list);
    } catch (e) {
      this.#error.set(e as Error);
    } finally {
      this.#loading.set(false);
    }
  }
}
```

No `BehaviorSubject`. No public writable signals. External code cannot mutate
state — only call methods.

### 2.4 HTTP call with `rxResource`

Prefer `rxResource` / `resource` for request-shaped async in components. The
resource is automatically reactive to its `params` and provides
`isLoading`, `error`, `value`, `hasValue`, `status`, `reload`.

```ts
import { rxResource } from '@angular/core/rxjs-interop';
import { HttpClient } from '@angular/common/http';
import { inject, input } from '@angular/core';

@Component({ /* ... */ })
export class InvoiceViewComponent {
  readonly invoiceId = input.required<string>();
  private readonly http = inject(HttpClient);

  readonly invoice = rxResource({
    params: () => ({ id: this.invoiceId() }),
    stream: ({ params }) =>
      this.http.get<Invoice>(`/api/invoices/${params.id}`),
  });
}
```

Template:

```html
@if (invoice.isLoading()) {
  <fuse-loading-bar />
} @else if (invoice.error(); as err) {
  <fuse-alert appearance="soft" type="error">{{ err.message }}</fuse-alert>
} @else if (invoice.hasValue()) {
  <invoice-details [data]="invoice.value()" />
}
```

Use `resource(...)` with `loader: async ({ params, abortSignal }) => …` when
the source is a promise (`fetch`, `firstValueFrom`) and cancellation is
handled via `AbortSignal`. Use `rxResource(...)` with `stream: …` when the
source is an Observable.

### 2.5 Effects and cleanup

- `effect(() => { ... })` inside a constructor / injection context ties its
  lifecycle to the enclosing component/service — no manual cleanup needed.
- If you subscribe to an Observable directly, chain `takeUntilDestroyed()`
  in an injection context, e.g. in the constructor. Never build custom
  `Subject` + `ngOnDestroy` teardown patterns.
- Do not run effects on every navigation to fetch data — use a `resource` /
  `rxResource` instead. Effects are for side effects, not for data flow.

---

## 3. Fuse integration

### 3.1 `FuseConfigService`

Provides the runtime app config (layout, scheme, theme, screens). Vendor
service exposes `config$: Observable<FuseConfig>`. Consumers **must** wrap
it with `toSignal` and never subscribe with the `async` pipe.

```ts
import { FuseConfigService } from '@fuse/services/config';
import { toSignal } from '@angular/core/rxjs-interop';
import { computed, inject } from '@angular/core';

const fuseConfig = inject(FuseConfigService);
const config = toSignal(fuseConfig.config$, { requireSync: true });
const isDark  = computed(() => config().scheme === 'dark');
```

Mutating config: assign to `fuseConfig.config = { scheme: 'dark' }`. Do not
introduce a parallel local signal for the same source of truth — read the
Fuse signal and write through the setter.

### 3.2 `FuseNavigationService`

Registry of navigation *components* and *data*. Use it to:

- Register a `<fuse-vertical-navigation>` or `<fuse-horizontal-navigation>`
  with a name, then toggle/open/close it by name from anywhere.
- Store per-key navigation item arrays and read them back.

Do not fork navigation types. Extend `FuseNavigationItem` via the item's
`meta` field or by wrapping in an app-level type.

### 3.3 Mock API (`@fuse/lib/mock-api`)

Register handlers in `src/app/mock-api/**` and register the aggregating
service via `provideFuse({ mockApi: { service: MockApiService } })` in
`app.config.ts`. Each handler:

```ts
this.#mock.onGet('/api/invoices').reply(({ request }) => [200, invoicesFixture]);
this.#mock.onPost('/api/invoices/:id').reply(({ urlParams, request }) => {
  const patched = { ...findById(urlParams.id), ...request.body };
  return [200, patched];
});
```

Never bypass the interceptor by calling `fetch()` — go through `HttpClient`
so tests and the mock layer stay consistent.

### 3.4 Theming — Tailwind

- Palettes and themes are defined in `<FRONTEND_ROOT>/tailwind.config.js`.
- Add a new brand palette with `generatePalette('#hex')` and register it
  under `themes.<id>`. Then add `{ id: 'theme-<id>', name: '<Name>' }` in
  the `provideFuse({ fuse: { themes } })` array in `app.config.ts`.
- Scheme toggling is done by adding `light` / `dark` on `<body>`; theme by
  adding `theme-<id>` on `<body>`. Vendor `LayoutComponent` already handles
  the mechanics — components should react via `FuseConfigService`, not by
  reading DOM classes.
- In templates: use Tailwind utility classes with responsive prefixes
  (`sm: md: lg: xl:`) matching the `screens` set in `FuseConfig`.
  Do not hand-roll SCSS for spacing/typography that Tailwind covers.

---

## 4. Anti-patterns (PROHIBITED — reject in review)

```ts
// ❌ Decorator inputs/outputs.
@Input() userId!: string;
@Output() saved = new EventEmitter<void>();

// ✅
readonly userId = input.required<string>();
readonly saved  = output<void>();
```

```ts
// ❌ BehaviorSubject for local component state.
private state$ = new BehaviorSubject<Foo>(initial);
value$ = this.state$.asObservable();

// ✅
readonly #state = signal<Foo>(initial);
readonly state  = this.#state.asReadonly();
```

```ts
// ❌ ViewChild decorator with `!` non-null assertion.
@ViewChild('el', { static: true }) el!: ElementRef<HTMLElement>;

// ✅
readonly el = viewChild.required<ElementRef<HTMLElement>>('el');
```

```html
<!-- ❌ Structural directives + async pipe. -->
<div *ngIf="user$ | async as u">
  <div *ngFor="let r of u.roles">{{ r.name }}</div>
</div>

<!-- ✅ New control flow + signals. -->
@if (user(); as u) {
  @for (r of u.roles; track r.id) { <div>{{ r.name }}</div> }
}
```

```ts
// ❌ Manual takeUntil teardown boilerplate.
private unsub$ = new Subject<void>();
ngOnInit()    { this.svc.data$.pipe(takeUntil(this.unsub$)).subscribe(...); }
ngOnDestroy() { this.unsub$.next(); this.unsub$.complete(); }

// ✅ takeUntilDestroyed at the edge, or convert to signal.
constructor() {
  this.svc.data$.pipe(takeUntilDestroyed()).subscribe(...);
  // or, preferably:
  this.data = toSignal(this.svc.data$, { initialValue: null });
}
```

```ts
// ❌ Editing vendor code.
// path: src/@fuse/components/navigation/vertical/vertical.component.ts
// (any change here is forbidden)

// ✅ Wrap it in src/app/layout/ or src/app/modules/…
```

```ts
// ❌ Component without OnPush / standalone.
@Component({ selector: 'x', templateUrl: './x.html' })
export class XComponent {}

// ✅
@Component({
  selector: 'x',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './x.html',
})
export class XComponent {}
```

```ts
// ❌ Data fetching in effect().
effect(() => {
  this.http.get(`/api/x/${this.id()}`).subscribe(v => this.data.set(v));
});

// ✅ rxResource.
readonly data = rxResource({
  params: () => ({ id: this.id() }),
  stream: ({ params }) => this.http.get<X>(`/api/x/${params.id}`),
});
```

```ts
// ❌ @for without track.
@for (item of items()) { <li>{{ item.name }}</li> }

// ✅ track is mandatory.
@for (item of items(); track item.id) { <li>{{ item.name }}</li> }
```

```ts
// ❌ NgModule.
@NgModule({ declarations: [X], exports: [X] }) export class XModule {}

// ✅ standalone component/directive/pipe, imported directly.
```

---

## 5. Checklist before proposing a change

- [ ] File is under `<FRONTEND_ROOT>` and not under `src/@fuse/`.
- [ ] Every new component has `standalone: true` and `OnPush`.
- [ ] Inputs/outputs/queries use signal APIs. No decorators added.
- [ ] Templates use `@if / @for (…; track …) / @switch`. No `*ngIf/*ngFor`.
- [ ] Async data uses `resource` / `rxResource` or `toSignal`. No lingering
      `BehaviorSubject` for state, no `async` pipe when a signal fits.
- [ ] RxJS survives only at true edges (HTTP, WS, DOM events).
- [ ] Effects are for side effects, not data flow. No manual `unsub$`.
- [ ] Fuse config/theme/nav consumed via the vendor services, not by
      touching the DOM or duplicating state.
- [ ] Tailwind classes align with `FuseConfig.screens` breakpoints.
- [ ] Any `signals-exception:` comment on the offending line has a real
      justification.
- [ ] No new `package.json`, lockfile, `.npmrc`, or `node_modules/` inside
      `<FRONTEND_ROOT>`. Any dep add/upgrade is done at the monorepo root.
- [ ] Build/serve/test wiring lives in `<FRONTEND_ROOT>/project.json` Nx
      targets, not in a local `scripts` block.
