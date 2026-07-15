# Módulos y controladores

> Volver a [SKILL.md](../SKILL.md)

## Módulos

- `TypeOrmModule.forRoot(...)` una única vez en `AppModule`.
- `TypeOrmModule.forFeature([Entity, ...])` en cada feature module que consuma entidades.
- Exportar servicios que otros módulos vayan a inyectar (para que sus pipes de existencia funcionen fuera del módulo owner).
- Un módulo por feature. No mezclar features en el mismo módulo.

```ts
@Module({
  imports: [
    ConfigModule.forRoot(),
    EventEmitterModule.forRoot(),
    TypeOrmModule.forRoot({
      type: '<dialect>',
      host: process.env.DB_HOST || 'localhost',
      // ...
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: false,
    }),
    FeatureModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
```

## Controladores

- `@Controller('<resource>')` en plural kebab-case.
- CRUD estándar: `@Get() @Get(':id') @Post() @Patch(':id') @Delete(':id')`.
- **Parámetros de ID SIEMPRE resueltos por pipe de existencia** (ver `existence-pipes.md`). Nunca recibir `id: string` crudo.
- FKs en el body pasan por su pipe de existencia via `@Body('key', EntityByIdPipe) entity: Entity`.
- `@UseInterceptors(InvokeAuditCreationInterceptor)` en `POST`/`PATCH`/`DELETE` cuando la operación deba auditarse.
- El controller retorna directamente `this.service.method(...)`; el servicio devuelve `ServiceResponse<T>` (ver `http-response-contract.md`).
- Sin `try/catch` en el controller. Sin transformaciones de datos ahí.

Canónico:

```ts
@Controller('features')
export class FeaturesController {
  constructor(private readonly service: FeaturesService) {}

  @Post()
  @UseInterceptors(InvokeAuditCreationInterceptor)
  create(@Body() dto: CreateFeatureDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id', FeatureByIdPipe) feature: Feature) {
    return this.service.findOne(feature);
  }

  @Patch(':id')
  @UseInterceptors(InvokeAuditCreationInterceptor)
  update(
    @Param('id', FeatureByIdPipe) feature: Feature,
    @Body() dto: UpdateFeatureDto,
  ) {
    return this.service.update(feature, dto);
  }

  @Delete(':id')
  @UseInterceptors(InvokeAuditCreationInterceptor)
  remove(@Param('id', FeatureByIdPipe) feature: Feature) {
    return this.service.remove(feature);
  }
}
```

Body con FKs anidadas:

```ts
@Post()
@UseInterceptors(InvokeAuditCreationInterceptor)
create(
  @Body('parent', ParentByIdPipe) parent: Parent,
  @Body('categoryIds', CategoriesByArrayBagPipe) categories: Category[],
  @Body() dto: CreateChildDto,
) {
  dto.categories = categories;
  return this.service.create(dto, parent);
}
```

Cadenas de pipes en body para flujos multipaso (ej: login):

```ts
@Public()
@Post('login')
@UsePipes(UserByEmailPipe, PasswordMatchPipe)
login(@Body() dto: CreateAuthDto, @Req() req: Request) {
  return this.authService.login(dto, req);
}
```

Decoradores custom para extraer contexto del token:

```ts
@Get('me')
me(@CurrentUser() user: JwtUser) { ... }
```
