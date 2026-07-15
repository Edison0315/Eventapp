# Interceptors, filtros, eventos, testing e integraciones

> Volver a [SKILL.md](../SKILL.md)

## Interceptors y filtros

- **Audit interceptor** vía `tap()` + emitter (ver `http-response-contract.md`).
- **Response reshape** vía `map()` preservando `ServiceResponse<T>` (ver `http-response-contract.md`).
- **Un solo filtro global** `AllExceptionsFilter` registrado con `APP_FILTER` (ver `http-response-contract.md`). No repetir filtros por módulo.

---

## Eventos (event-driven side effects)

```ts
// AppModule
imports: [EventEmitterModule.forRoot()]
```

Emitter:

```ts
@Injectable()
export class EmiterService {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  createAudit(dto: CreateAuditDto) {
    this.eventEmitter.emit('createAudit', dto);
  }

  sendEmailWithTemplate(req: TemplateEmailRequest) {
    this.eventEmitter.emit('sendMailWithTemplate', req);
  }
}
```

Listener:

```ts
@Injectable()
export class ListenerProvider {
  constructor(
    private readonly smtp: SmtpService,
    private readonly audit: AuditService,
  ) {}

  @OnEvent('createAudit')
  handleCreateAudit(dto: CreateAuditDto) {
    return this.audit.create(dto);
  }

  @OnEvent('sendMailWithTemplate')
  handleSendMail(req: TemplateEmailRequest) {
    return this.smtp.sendWithTemplate(req);
  }
}
```

Módulo listener `@Global()` exportando `EmiterService`.

---

## Testing

- `*.spec.ts` colocados junto al source.
- `Test.createTestingModule({ controllers, providers }).compile()` seguido de `module.get<T>(T)`.
- E2E en `test/*.e2e-spec.ts` con `supertest` y `AppModule` completo.
- Mockear repos vía `getRepositoryToken(Entity)` con `useValue: { find: jest.fn(), ... }`.

---

## Integraciones externas

- Ubicar en `src/integrations/<lib>/<lib>.service.ts` (o `<lib>.module.ts` si es dynamic).
- Clases wrapper `@Injectable()` con métodos de instancia si consumen otras dependencias.
- Se acepta `@Injectable()` con métodos `static` cuando la clase no tiene estado ni dependencias inyectables (`BcryptService.hash(...)`, `CryptoService.encrypt(...)`), pero preferir métodos de instancia para permitir mocking en tests.
