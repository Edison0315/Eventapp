# Pipes de existencia — REGLA OBLIGATORIA

> Volver a [SKILL.md](../SKILL.md)

## Regla dura

**Toda verificación de existencia de recurso (por ID, slug, email, código, etc.) se hace en un Pipe personalizado, nunca dentro del service.** El controlador recibe la entidad ya resuelta y tipada.

Motivación:
- El service se libera de lanzar `NotFoundException`.
- El controller expresa la intención: "necesito un `Feature`, no un `id`".
- La lógica de existencia es reutilizable en `@Param` y `@Body`.

## Ubicación

`src/modules/<feature>/pipes/<entity>-by-<field>/<entity>-by-<field>.pipe.ts`

Ej: `pipes/feature-by-id/feature-by-id.pipe.ts`, `pipes/user-by-email/user-by-email.pipe.ts`.

## Contrato canónico

```ts
import { Injectable, NotFoundException, PipeTransform } from '@nestjs/common';
import { FeaturesService } from '../../features.service';
import { Feature } from '../../entities/feature.entity';

@Injectable()
export class FeatureByIdPipe implements PipeTransform {
  constructor(private readonly service: FeaturesService) {}

  async transform(value: string): Promise<Feature> {
    const feature = await this.service.findOneById(+value);
    if (!feature) {
      throw new NotFoundException(`Feature with id ${value} was not found`);
    }
    return feature;
  }
}
```

Reglas:
- El pipe DEVUELVE la entidad, nunca un boolean.
- El service expone un método interno `findOneById(id): Promise<Entity | null>` que retorna `null` cuando no existe. **Ese método no envuelve con `buildResponse`.**
- Mensaje de error: `<EntityName> with <field> ${value} was not found`.
- Si el ID es numérico, coercionar con `+value` dentro del pipe.
- Si el ID es UUID string, no coercionar.

## Registro

- Declarar `FeaturesService` en `providers` del `FeaturesModule`.
- Nest resuelve el pipe por DI automáticamente al usarse en `@Param(':id', FeatureByIdPipe)`.
- Si otro módulo necesita el pipe, `exports: [FeaturesService]` en `FeaturesModule` y luego importar `FeaturesModule` en el consumidor.
- El pipe en sí normalmente vive junto al feature dueño; si es cross-cutting, puede vivir en `src/common/pipes/`.

## Combinación con `ParseIntPipe` / `ParseUUIDPipe`

Opcional. La coerción se puede delegar al Parse pipe encadenado:

```ts
@Get(':id')
findOne(@Param('id', ParseIntPipe, FeatureByIdPipe) feature: Feature) { ... }
```

Si se prefiere concentrar todo en el pipe custom, encadenar Parse pipes es innecesario; solo asegurar la coerción o validación dentro de `transform`.

## Consumo en controllers

```ts
@Get(':id')
findOne(@Param('id', FeatureByIdPipe) feature: Feature) {
  return this.service.findOne(feature);
}

@Patch(':id')
update(
  @Param('id', FeatureByIdPipe) feature: Feature,
  @Body() dto: UpdateFeatureDto,
) {
  return this.service.update(feature, dto);
}
```

Body FK anidada:

```ts
@Post()
create(
  @Body('parent', ParentByIdPipe) parent: Parent,
  @Body() dto: CreateChildDto,
) {
  return this.service.create(parent, dto);
}
```

## Pipe para arreglos de IDs (array bag)

```ts
@Injectable()
export class CategoriesByArrayBagPipe implements PipeTransform {
  constructor(private readonly categoriesService: CategoriesService) {}
  async transform(value: Array<string | number>): Promise<Category[]> {
    const { data: categories } = await this.categoriesService.findByIdArray(value);
    if (!categories) throw new NotFoundException(`Categories not valid`);
    return categories;
  }
}
```

## Pipe request-scoped (contexto multi-tenant / tenant id)

```ts
@Injectable()
export class FeatureByIdPipe implements PipeTransform {
  constructor(
    private readonly service: FeaturesService,
    @Inject(REQUEST) private readonly request: any,
  ) {}

  async transform(value: any) {
    const tenantId = getTenantIdFromRequest(this.request);
    const feature = await this.service.findOneById(value, tenantId);
    if (!feature) {
      throw new NotFoundException(`Feature with id ${value} was not found`);
    }
    return feature;
  }
}
```

## Cadenas de pipes que transforman

Cuando un flujo requiere resolver una entidad y luego validar algo derivado, encadenar pipes vía `@UsePipes`:

```ts
@UsePipes(UserByEmailPipe, PasswordMatchPipe)
login(@Body() dto: CreateAuthDto) { ... }
```

`UserByEmailPipe.transform(dto)` retorna `User` con el password crudo del DTO adjunto en un campo temporal; `PasswordMatchPipe.transform(user)` valida y retorna el user. Nota: mutar la entidad para transportar datos es aceptable **solo** en este patrón acotado; preferir un DTO envolvente si el flujo crece.
