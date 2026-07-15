# Formato estándar de respuestas HTTP — CONTRATO ÚNICO

> Volver a [SKILL.md](../SKILL.md)

## Definición obligatoria

Ubicar en `src/common/interfaces/service-response.interface.ts`:

```ts
export interface ServiceResponse<T> {
  statusCode: number;
  metaData: Record<string, unknown>;
  count: number;
  data: T[];
}

export function buildResponse<T>(
  data: T[],
  statusCode = 200,
  metaData: Record<string, unknown> = {},
): ServiceResponse<T> {
  return { statusCode, metaData, count: data.length, data };
}
```

## Reglas de uso

- **Todos** los endpoints REST retornan `ServiceResponse<T>` construido con `buildResponse`. Sin excepciones.
- **Endpoints singulares** (`findOne`, `create`, `update`, `remove`): la entidad se envuelve en un arreglo de un solo elemento — `buildResponse([entity], HttpStatus.CREATED)`. El invariante `data: T[]` se preserva siempre; consumidores hacen `data[0]`.
- **Endpoints de lista**: `buildResponse(rows, HttpStatus.OK, { total, page, pageSize })`. El `count` se autocalcula desde `data.length` — pasar `total` en `metaData` cuando difiera (paginación).
- **Paginación** vive en `metaData`: `{ total, page, pageSize, hasNext, cursor, ... }`. El campo `count` del contrato es la longitud del arreglo devuelto en esta página.
- **Nunca** retornar entidades crudas o construir `{ statusCode, data, count }` inline. Usar el helper.
- `data` siempre es un arreglo, incluso vacío `[]`.

## Ejemplos

```ts
// singular
return buildResponse([feature], HttpStatus.CREATED);

// lista simple
const [rows, total] = await this.repo.findAndCount();
return buildResponse(rows, HttpStatus.OK, { total });

// lista paginada
const [rows, total] = await this.repo.findAndCount({ skip, take });
return buildResponse(rows, HttpStatus.OK, {
  total,
  page,
  pageSize: take,
  hasNext: skip + rows.length < total,
});

// borrado exitoso
return buildResponse([feature], HttpStatus.OK, { deleted: true });
```

## Interacción con interceptors

Los interceptors que reshapan la respuesta **deben preservar el contrato**: mapear `response.data`, recomputar `count`, mantener `statusCode` y `metaData`.

```ts
@Injectable()
export class TransformFeatureResponseInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((response: ServiceResponse<Feature>) => {
        const data = response.data.map(f => ({
          id: f.id,
          name: f.name,
          // shape específico
        }));
        return { ...response, data, count: data.length };
      }),
    );
  }
}
```

## Interceptor de auditoría (patrón side-effect)

`InvokeAuditCreationInterceptor` en POST/PATCH/DELETE lee `response.data[0]`, obtiene el nombre físico de tabla via `getMetadataArgsStorage()` y emite un evento a `EventEmitter2`:

```ts
@Injectable()
export class InvokeAuditCreationInterceptor implements NestInterceptor {
  constructor(private readonly emitter: EmiterService) {}
  private readonly auditedActions = {
    POST: 'CREATE',
    PATCH: 'UPDATE',
    DELETE: 'DELETE',
  };

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      tap((response: ServiceResponse<any>) => {
        const entity = response.data[0];
        if (!entity) return;
        const meta = getMetadataArgsStorage().tables.find(t => t.target === entity.constructor);
        const req = ctx.switchToHttp().getRequest();
        const action = this.auditedActions[req.method];
        const tableName = meta?.name;
        if (!action || !tableName) return;
        this.emitter.createAudit({
          table: tableName,
          operation: action,
          user: req.user,
          body: JSON.stringify(req.body),
        });
      }),
    );
  }
}
```

## Filtro de excepciones global (obligatorio de existir)

Registrar `AllExceptionsFilter` con `APP_FILTER` para que los errores viajen también con `ServiceResponse`:

```ts
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
    const message = exception instanceof HttpException
      ? exception.getResponse()
      : 'Internal server error';
    res.status(status).json({
      statusCode: status,
      metaData: { error: message },
      count: 0,
      data: [],
    });
  }
}
```

Si el proyecto destino no lo tiene, marcar como TODO obligatorio.
