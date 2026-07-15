# Anti-patrones — NO hacer

> Volver a [SKILL.md](../SKILL.md)

Ejemplos negativos observados o previsibles:

- ❌ **Validar existencia dentro del service.**
  ```ts
  // MAL
  async findOne(id: number) {
    const feature = await this.repo.findOneBy({ id });
    if (!feature) throw new NotFoundException(`Feature ${id} not found`);
    return buildResponse([feature]);
  }
  ```
  BIEN: `findOneById` retorna `null`; el `FeatureByIdPipe` lanza `NotFoundException` antes de llegar al service.

- ❌ **Retornar entidades crudas del controller o service.**
  ```ts
  // MAL
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.repo.findOneBy({ id: +id });
  }
  ```
  BIEN: pipe de existencia + `buildResponse([entity])`.

- ❌ **Construir el sobre inline en cada service.**
  ```ts
  // MAL
  return { statusCode: HttpStatus.CREATED, data: [feature], count: 1 };
  ```
  BIEN: `return buildResponse([feature], HttpStatus.CREATED);`

- ❌ **Abrir QueryRunner para operación de una sola entidad.** Si solo hay un `save`, usar el repo directamente. QueryRunner reserva connection y añade overhead sin ganar atomicidad extra.

- ❌ **QueryRunner sin `rollback` en catch o sin `release` en finally.**
  ```ts
  // MAL — fuga de conexión + transacción colgada
  const qr = this.ds.createQueryRunner();
  await qr.connect();
  await qr.startTransaction('READ COMMITTED');
  try {
    /* ... */
    await qr.commitTransaction();
    return buildResponse([x]);
  } catch (error) {
    throw error;
  }
  ```
  BIEN: incluir `await qr.rollbackTransaction()` en catch y `await qr.release()` en finally.

- ❌ **Múltiples transacciones consecutivas donde debería haber una atómica.**
  ```ts
  // MAL — el segundo commit no revierte el primero si algo falla después
  async createOrchestrator(dto) {
    const parent = await this.create(dto);          // commit interno
    await this.rolesService.assignRoles(parent.id); // otro QueryRunner
  }
  ```
  BIEN: un solo `QueryRunner` propagado como parámetro a helpers y servicios auxiliares.

- ❌ **`try { ... } catch (error) { throw error; }` vacío.** Ruido puro. Omitir el `try/catch` completamente si no se transforma ni loguea nada.

- ❌ **Pasar IDs crudos al service desde el controller.**
  ```ts
  // MAL
  update(@Param('id') id: string, @Body() dto) {
    return this.service.update(+id, dto);
  }
  ```
  BIEN: `@Param('id', FeatureByIdPipe) feature: Feature` — el service recibe la entidad.

- ❌ **`useValue` para valores que provienen de `ConfigService.get(...)`.** Usar factory con `inject: [ConfigService]`.

- ❌ **Mutar entidades en pipes para transportar datos entre pipes** más allá del patrón acotado de login. Preferir un DTO envolvente.

- ❌ **Retornar el DTO como `data` en lugar de la entidad persistida** (viola el invariante `data: T[]` donde `T` es la entidad).

- ❌ **`@Injectable()` sobre clases con solo métodos `static`** que nunca se inyectan. O bien registrar y usar por DI, o dejar la clase plana sin decorador.

- ❌ **Lanzar `HttpException` desde `createParamDecorator`.** Mover la validación a un guard.

- ❌ **Migraciones ad-hoc sin control.** Si el proyecto no usa las de TypeORM, mantener runner custom con tabla de tracking; nunca ejecutar SQL suelto en producción.

- ❌ **`try/catch` que suprime el error transformándolo en un `HttpStatus.OK`.** Dejar que el filtro global normalice.
