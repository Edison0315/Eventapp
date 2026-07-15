---
name: nestjs-backend-conventions
description: Convenciones y patrones NestJS + TypeORM extraídos de un backend real. Usar cuando se creen módulos, controladores, servicios, DTOs, entidades, pipes de validación/existencia, guards, interceptors o migraciones en NestJS; cuando se elija entre repositorio directo y QueryRunner; o cuando se defina el contrato de respuesta HTTP. Incluye consulta obligatoria a Context7 y checklist de Definition of Done.
---

# NestJS Backend Conventions

Guía normativa portable para agentes que escriben código backend NestJS + TypeORM. Todas las reglas provienen de patrones observados en un backend real; no son folklore genérico de NestJS. Cuando exista conflicto entre esta guía y la documentación oficial actualizada, **prevalece esta guía**.

Nomenclatura genérica: `Entity`, `Feature`, `Parent`, `Child`. Reemplazar por el nombre real al aplicar.

Este archivo cubre las reglas de oro y el índice. Los detalles con ejemplos de código completos viven en `references/`; ábrelos solo cuando la tarea concreta los necesite.

---

## 0. Consulta obligatoria a Context7 (SIEMPRE PRIMERO)

Antes de generar código nuevo (módulo, controller, service, pipe, entidad, DTO, guard, migración), el agente **debe** consultar documentación actualizada vía el MCP `context7`:

1. Leer `package.json` del proyecto destino para identificar versiones instaladas.
2. Para cada una de estas librerías si aparece en `package.json`, invocar `mcp__plugin_context7_context7__resolve-library-id` y luego `mcp__plugin_context7_context7__query-docs` con la consulta específica a la tarea:
   - `@nestjs/common`, `@nestjs/core`
   - `@nestjs/typeorm`, `typeorm`
   - `class-validator`, `class-transformer`
   - `@nestjs/mapped-types`
   - `@nestjs/passport`, `passport`, `passport-jwt`, `@nestjs/jwt`
   - `@nestjs/event-emitter`
   - `@nestjs/config`
3. Contrastar las mejores prácticas obtenidas contra las reglas de este skill. **En caso de conflicto, prevalecen las reglas del skill.** Registrar en un breve comentario o mensaje al usuario cualquier desviación consciente.

No omitir este paso ni siquiera para tareas que parezcan triviales.

---

## 1. Estructura de carpetas y naming

```
src/
├── main.ts
├── app.module.ts
├── app.controller.ts
├── app.service.ts
├── common/                       # cross-cutting
│   ├── classes/
│   ├── decorators/
│   ├── entities/
│   ├── events/
│   ├── guards/
│   ├── helpers/
│   ├── interceptors/
│   ├── interfaces/
│   ├── pipes/
│   └── services/
├── database/                     # migration runner (si aplica)
├── integrations/                 # wrappers de libs externas
│   └── <lib_name>/
└── modules/
    └── <domain>/
        └── <feature_name>/
            ├── <feature>.module.ts
            ├── <feature>.controller.ts
            ├── <feature>.controller.spec.ts
            ├── <feature>.service.ts
            ├── <feature>.service.spec.ts
            ├── dto/
            │   ├── create-<feature>.dto.ts
            │   └── update-<feature>.dto.ts
            ├── entities/
            │   └── <feature>.entity.ts
            ├── pipes/
            │   └── <entity>-by-id/
            │       ├── <entity>-by-id.pipe.ts
            │       └── <entity>-by-id.pipe.spec.ts
            └── interceptors/
                └── <n>/
                    └── <n>.interceptor.ts
```

Reglas:
- **Folders: `snake_case`** (ej: `user_plants/`, `train_units/`, `data_base_connections/`).
- **Files: `kebab-case`** con sufijos: `.module.ts`, `.controller.ts`, `.service.ts`, `.dto.ts`, `.entity.ts`, `.pipe.ts`, `.interceptor.ts`, `.guard.ts`, `.strategy.ts`, `.spec.ts`.
- **Classes: `PascalCase`** coincidiendo con el file (`UsersService`, `EntityByIdPipe`).
- Rutas HTTP: plural kebab-case (`@Controller('users')`, `@Controller('data-base-connections')`).
- Cada pipe y cada interceptor viven en **su propia subcarpeta** con el mismo nombre del archivo.
- Tests colocados junto al source (`*.spec.ts`).
- E2E en `test/*.e2e-spec.ts` en la raíz del proyecto.
- Imports absolutos `src/...` habilitados por `tsconfig.baseUrl: "./"`.

---

## 2. Reglas de oro (resumen)

Estas son las reglas no negociables. El detalle y los ejemplos de cada una están en su referencia:

| Regla | Referencia |
|---|---|
| DI: `private readonly`, class-token providers por default, `useFactory` con `inject`, `forwardRef` para ciclos | `references/dependency-injection.md` |
| Un módulo por feature; controllers sin `try/catch` ni transformaciones; IDs siempre resueltos por pipe | `references/modules-and-controllers.md` |
| CRUD de una entidad → repo directo. Escritura padre+hijos / cross-aggregate → QueryRunner manual con los 5 pasos obligatorios | `references/persistence.md` |
| Toda validación de existencia va en un Pipe, nunca en el service | `references/existence-pipes.md` |
| Todo endpoint retorna `ServiceResponse<T>` vía `buildResponse(...)`; `data` siempre es arreglo | `references/http-response-contract.md` |
| DTOs con `class-validator`; `UpdateDto` vía `PartialType`; entidades con `@Entity({name, schema})` y columnas con nombre físico | `references/dtos-and-entities.md` |
| Guard JWT global + `@Public()` explícito en rutas sin auth | `references/auth-guards.md` |
| Interceptors, filtro global de excepciones, eventos, testing, integraciones externas | `references/interceptors-events-testing.md` |
| Multi-tenant / DataSource dinámico (solo si aplica) | `references/multi-tenant.md` |
| Catálogo de anti-patrones con ejemplos MAL/BIEN | `references/anti-patterns.md` |

---

## 3. Definition of Done

Antes de dar por terminado cualquier cambio, verificar:

- [ ] Context7 consultado para librerías clave del `package.json` antes de escribir código.
- [ ] Pipe de existencia aplicado en cada `@Param('id', ...)` y en cada `@Body('fkKey', ...)` de recurso.
- [ ] Toda respuesta REST envuelta con `buildResponse(...)`. Cero objetos literales `{ statusCode, data, count }` inline en el service.
- [ ] Endpoints singulares retornan `data: [entity]` (arreglo de un elemento).
- [ ] Paginación (si aplica) transportada en `metaData: { total, page, pageSize }`.
- [ ] DI declarada según `references/dependency-injection.md`: `private readonly`, class tokens, `useFactory` con `inject` cuando aplica, `forwardRef` para ciclos.
- [ ] Elección ORM vs QueryRunner justificada según `references/persistence.md`. Si no es obvia, un comentario breve.
- [ ] Si se abrió `QueryRunner`: `connect` → `startTransaction('READ COMMITTED')` → `commit` en try → `rollback` en catch → `release` en finally. Sin excepciones.
- [ ] Método `findOneById` del service retorna `Entity | null` sin `buildResponse`.
- [ ] DTOs con `class-validator`; UpdateDto vía `PartialType(CreateDto)`.
- [ ] Entidades con `@Entity({ name, schema })` y columnas con `name:` físico.
- [ ] `@Public()` explícito en rutas sin auth; el resto queda protegido por el guard global JWT.
- [ ] Interceptor de auditoría en POST/PATCH/DELETE que persistan datos.
- [ ] Filtro global de excepciones existe y responde `ServiceResponse`.
- [ ] Sin `try { ... } catch (error) { throw error; }` vacíos.
- [ ] Sin validación de existencia dentro del service.

Antes de cerrar la tarea, comparar el diff contra `references/anti-patterns.md` — es el catálogo de errores más comunes en este stack.
