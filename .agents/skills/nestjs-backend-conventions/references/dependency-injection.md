# Inyección de dependencias

> Volver a [SKILL.md](../SKILL.md)

## 1. Constructor injection

- Servicios inyectados como dependencia: `private readonly`.
- Repositorios y `DataSource`: `private readonly` recomendado.
- Sin decorador `@Inject()` cuando se inyecta por token de clase.

```ts
@Injectable()
export class FeatureService {
  constructor(
    @InjectRepository(Entity) private readonly repo: Repository<Entity>,
    private readonly dataSource: DataSource,
    private readonly otherService: OtherService,
  ) {}
}
```

## 2. Class-token providers (default)

```ts
@Module({
  imports: [TypeOrmModule.forFeature([Entity])],
  controllers: [FeatureController],
  providers: [FeatureService],
  exports: [FeatureService],
})
export class FeatureModule {}
```

## 3. String tokens con `@Inject('TOKEN')`

Usar cuando una interface no tiene una clase concreta única (implementaciones intercambiables por entorno).

```ts
constructor(
  @Inject('IBatchDataSource')
  private readonly dataSource: IBatchDataSource,
) {}
```

## 4. `useFactory` custom provider con `inject`

```ts
providers: [
  {
    provide: 'IBatchDataSource',
    useFactory: (cfg: ConfigService, http: HttpClientService) => {
      const isProd = cfg.get<string>('IS_PROD') === 'true';
      return isProd ? new BatchApiDataSource(http) : new BatchMockDataSource();
    },
    inject: [ConfigService, HttpClientService],
  },
],
```

## 5. `useClass` con providers globales

Guards / Interceptors / Filters globales se registran con `APP_GUARD` / `APP_INTERCEPTOR` / `APP_FILTER`:

```ts
providers: [
  { provide: APP_GUARD, useClass: JwtAuthGuard },
],
```

## 6. `registerAsync` (dynamic modules)

```ts
JwtModule.registerAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: async (cfg: ConfigService) => ({
    secret: cfg.get<string>('JWT_SECRET'),
  }),
}),
```

`TypeOrmModule.forRootAsync` sigue el mismo patrón.

## 7. Request-scoped injection

Usar `@Inject(REQUEST)` en pipes que necesitan estado del request (tenant id, usuario). No declarar `Scope.REQUEST` explícito.

```ts
constructor(
  private readonly service: EntitiesService,
  @Inject(REQUEST) private readonly request: any,
) {}
```

## 8. `forwardRef` para ciclos

```ts
imports: [forwardRef(() => OtherModule)],
```

En el constructor del provider consumidor:

```ts
constructor(
  @Inject(forwardRef(() => OtherService))
  private readonly otherService: OtherService,
) {}
```

## 9. `@Global()` para módulos ubicuos

Únicamente para infra transversal (event bus, config): decorar el módulo con `@Global()` y exportar solo lo estrictamente necesario.

## 10. Reglas negativas

- ❌ NO usar `useValue` para constantes que provengan de `ConfigService.get(...)`.
- ❌ NO usar `Symbol`-based tokens; siempre string o class token.
- ❌ NO declarar `Scope.TRANSIENT` sin motivo explícito documentado.
