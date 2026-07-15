# Persistencia — Repositorio directo vs QueryRunner

> Volver a [SKILL.md](../SKILL.md)

## Regla de elección

| Escenario | Herramienta |
|-----------|-------------|
| CRUD sobre **una sola entidad**, sin escrituras relacionadas | `@InjectRepository(Entity)` + métodos del repo |
| Escritura **padre + hijos**, delete-and-replace de colecciones, cross-aggregate | `DataSource.createQueryRunner()` con transacción manual |
| Bulk upsert simple (mismo tipo de entidad, muchas filas) | `repo.manager.transaction(async manager => …)` |
| Query compleja con joins condicionales, `addSelect` de columnas `select:false` | `repo.createQueryBuilder(...)` |
| Multi-tenant / DataSource dinámico | Ver `multi-tenant.md` |

## Patrón repo directo

Aplicable a `create`, `findAll`, `findOne`, `update`, `remove` de una única entidad:

```ts
@Injectable()
export class FeaturesService {
  constructor(
    @InjectRepository(Feature) private readonly repo: Repository<Feature>,
  ) {}

  async create(dto: CreateFeatureDto): Promise<ServiceResponse<Feature>> {
    const feature = this.repo.create(dto);
    await this.repo.save(feature);
    return buildResponse([feature], HttpStatus.CREATED);
  }

  async findAll(): Promise<ServiceResponse<Feature>> {
    const [data, total] = await this.repo.findAndCount();
    return buildResponse(data, HttpStatus.OK, { total });
  }

  async findOne(feature: Feature): Promise<ServiceResponse<Feature>> {
    return buildResponse([feature], HttpStatus.OK);
  }

  async findOneById(id: number): Promise<Feature | null> {
    return this.repo.findOneBy({ id });
  }

  async update(feature: Feature, dto: UpdateFeatureDto): Promise<ServiceResponse<Feature>> {
    Object.assign(feature, dto);
    await this.repo.save(feature);
    return buildResponse([feature], HttpStatus.OK);
  }

  async remove(feature: Feature): Promise<ServiceResponse<Feature>> {
    await this.repo.remove(feature);
    return buildResponse([feature], HttpStatus.OK);
  }
}
```

Nota: `findOneById` devuelve `Entity | null` **sin** wrap. Es método interno consumido por el pipe (ver `existence-pipes.md`).

## Patrón QueryRunner completo (OBLIGATORIO cuando aplica)

Los cinco pasos son innegociables: `connect` → `startTransaction('READ COMMITTED')` → `commit` en try → `rollback` en catch → `release` en finally.

```ts
@Injectable()
export class ParentsService {
  constructor(
    @InjectRepository(Parent) private readonly repo: Repository<Parent>,
    private readonly dataSource: DataSource,
  ) {}

  async create(dto: CreateParentDto): Promise<ServiceResponse<Parent>> {
    const qr: QueryRunner = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction('READ COMMITTED');
    try {
      const parent = qr.manager.create(Parent, dto);
      const parentSaved = await qr.manager.save(Parent, parent);

      if (dto.childrenIds?.length) {
        const promises = dto.childrenIds.map(childId => {
          const link = qr.manager.create(ParentChild, {
            child: childId,
            parent: parentSaved.id as unknown as Parent,
          });
          return qr.manager.save(ParentChild, link);
        });
        await Promise.all(promises);
      }

      await qr.commitTransaction();
      return buildResponse([parentSaved], HttpStatus.CREATED);
    } catch (error) {
      await qr.rollbackTransaction();
      throw error;
    } finally {
      await qr.release();
    }
  }
}
```

## Propagar QueryRunner entre helpers y servicios

Cuando una operación atómica cruza responsabilidades de más de un servicio, **pasar el `QueryRunner` como parámetro** hacia los métodos privados o hacia el servicio auxiliar. Todas las escrituras deben usar `qr.manager` — no `this.repo` — para participar de la misma transacción.

```ts
interface CreateChildContext {
  queryRunner: QueryRunner;
  parent: Parent;
  child: ChildDto;
}

async createChildInTransaction(ctx: CreateChildContext): Promise<void> {
  const { queryRunner, parent, child } = ctx;
  const created = queryRunner.manager.create(Child, {
    parent,
    ...child,
  });
  await queryRunner.manager.save(Child, created);
}
```

## Bulk upsert simple

Cuando la operación es N filas del mismo tipo sin colecciones relacionadas:

```ts
async updateBulk(dto: UpdateFeatureDto): Promise<ServiceResponse<UpdateFeatureDto>> {
  const entries = Object.entries(dto).filter(([, v]) => v !== undefined);
  await this.repo.manager.transaction(async manager => {
    for (const [name, value] of entries) {
      await manager.upsert(Feature, { name, value }, ['name']);
    }
  });
  return buildResponse([dto], HttpStatus.OK);
}
```

## QueryBuilder para queries complejas

Usar `createQueryBuilder` cuando se necesiten:
- Joins condicionales.
- `addSelect` de columnas marcadas `select: false` (contraseñas, secretos).
- Filtrado dinámico complejo.

```ts
async findOneByEmail(email: string): Promise<User | null> {
  return this.userRepo
    .createQueryBuilder('user')
    .leftJoinAndSelect('user.userPlants', 'up', 'up.active = :active', { active: true })
    .leftJoinAndSelect('up.plant', 'plant')
    .where('user.login = :email', { email })
    .addSelect('user.password')
    .getOne();
}
```
