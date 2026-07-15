# Multi-tenant / DataSource dinámico (opcional)

> Volver a [SKILL.md](../SKILL.md)
>
> Aplicar SOLO si el proyecto destino maneja múltiples bases por tenant.

## DatabaseConnectionService

Servicio central que resuelve `DataSource` por `dbConfigId` cacheado (mantener un `Map<number, DataSource>` en memoria).

```ts
@Injectable()
export class DatabaseConnectionService {
  private cache = new Map<number, DataSource>();

  constructor(
    @InjectRepository(DataBaseConnection)
    private readonly repo: Repository<DataBaseConnection>,
  ) {}

  async getDataSource<E>(
    dbConfigId: number,
    ...entities: EntityTarget<E>[]
  ): Promise<DataSource> {
    if (this.cache.has(dbConfigId)) return this.cache.get(dbConfigId)!;
    const cfg = await this.repo.findOneByOrFail({ id: dbConfigId });
    const ds = new DataSource({
      type: '<dialect>',
      host: cfg.host, port: cfg.port,
      username: cfg.username, password: cfg.password,
      database: cfg.database,
      entities: entities as any[],
    });
    await ds.initialize();
    this.cache.set(dbConfigId, ds);
    return ds;
  }

  async getRepository<E>(
    entity: EntityTarget<E>,
    dbConfigId: number,
    allEntities: EntityTarget<any>[] = [entity],
  ): Promise<Repository<E>> {
    const ds = await this.getDataSource(dbConfigId, ...allEntities);
    return ds.getRepository(entity);
  }
}
```

## BaseDynamicDbService

```ts
export abstract class BaseDynamicDbService<Entity> {
  constructor(
    protected readonly dbConnectionService: DatabaseConnectionService,
    private readonly entityClass: EntityTarget<Entity>,
    private readonly relatedEntities: EntityTarget<any>[] = [],
  ) {}

  protected async getRepository(dbConfigId: number): Promise<Repository<Entity>> {
    const all = [this.entityClass, ...this.relatedEntities];
    return this.dbConnectionService.getRepository(this.entityClass, dbConfigId, all);
  }
}
```

Extender:

```ts
@Injectable()
export class TrainsService extends BaseDynamicDbService<Train> {
  constructor(protected readonly dbConnectionService: DatabaseConnectionService) {
    super(dbConnectionService, Train, [TrainUnit, Configuration]);
  }

  async findAll(dbConfigId: number): Promise<ServiceResponse<Train>> {
    const repo = await this.getRepository(dbConfigId);
    const [data, total] = await repo.findAndCount();
    return buildResponse(data, HttpStatus.OK, { total });
  }
}
```

## Guard, decorator y pipe request-scoped

```ts
@Injectable()
export class DbConnectionValidationGuard implements CanActivate {
  constructor(
    @InjectRepository(DataBaseConnection)
    private readonly repo: Repository<DataBaseConnection>,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const dbConfigId = req.user?.dbConfigId;
    if (!dbConfigId) throw new UnauthorizedException('Missing dbConfigId in token');
    const cfg = await this.repo.findOne({ where: { id: dbConfigId } });
    if (!cfg) throw new UnauthorizedException(`Invalid dbConfigId: ${dbConfigId}`);
    req.dbConfig = cfg;
    return true;
  }
}

export const DbConfigId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): number => {
    const req = ctx.switchToHttp().getRequest();
    const dbConfigId = req.user?.dbConfigId;
    if (!dbConfigId) throw new NotFoundException('dbConfigId not found');
    req['dbConfigId'] = dbConfigId;
    return dbConfigId;
  },
);
```

Pipe request-scoped que consume `dbConfigId`: ver la sección "Pipe request-scoped" en `existence-pipes.md`.

Controller:

```ts
@Get(':id')
findOne(
  @Param('id', TrainByIdPipe) train: Train,
  @DbConfigId() dbConfigId: number,
) {
  return this.trainsService.findOne(train, dbConfigId);
}
```
