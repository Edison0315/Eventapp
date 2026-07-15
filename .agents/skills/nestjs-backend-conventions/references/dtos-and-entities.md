# DTOs, validación y entidades TypeORM

> Volver a [SKILL.md](../SKILL.md)

## DTOs y validación

### `ValidationPipe` global

En `main.ts`:

```ts
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      transformOptions: { exposeDefaultValues: true },
    }),
  );
  await app.listen(3000);
}
```

### Create DTO

```ts
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty, IsInt, IsNotEmpty, IsOptional, IsString,
  MaxLength, MinLength, ValidateNested,
} from 'class-validator';

export class CreateFeatureDto {
  @IsString() @MinLength(5) @MaxLength(255)
  name: string;

  @IsNotEmpty() @IsInt() @Type(() => Number)
  parent: Parent;

  @IsOptional() @IsInt({ each: true }) @Type(() => Number)
  categoryIds?: Category[];

  @ArrayNotEmpty() @ValidateNested({ each: true }) @Type(() => NestedItemDto)
  items: NestedItemDto[];
}
```

### Update DTO

```ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateFeatureDto } from './create-feature.dto';

export class UpdateFeatureDto extends PartialType(CreateFeatureDto) {}
```

### Query DTO con `@Matches`

```ts
import { IsNotEmpty, Matches } from 'class-validator';

export class GetReportQueryDto {
  @IsNotEmpty()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, {
    message: 'Date must be in YYYY-MM-DD format',
  })
  date_start: string;
}
```

### Decoradores en uso

`@IsString`, `@IsInt`, `@IsBoolean`, `@IsEmail`, `@IsNotEmpty`, `@IsOptional`, `@IsArray`, `@ArrayNotEmpty`, `@MinLength`, `@MaxLength`, `@ValidateNested`, `@Matches`. Transformación: `@Type(() => Number)`, `@Type(() => NestedDto)`.

---

## Entidades TypeORM

- `@Entity({ name: 'PhysicalTableName', schema: '<schema>' })` — schema explícito.
- Mapping nombre físico ↔ nombre TS: `@Column({ name: 'CreationDate' }) creationDate: Date`.
- `@PrimaryGeneratedColumn({ name: 'Id' })` cuando aplica.
- Relaciones: `@ManyToOne` + `@JoinColumn({ name: 'FkId' })`; `@OneToMany` inverso.
- Hooks: `@BeforeInsert` / `@BeforeUpdate` para hashing, encriptación, defaults calculados.
- `@Column({ select: false })` para campos sensibles (password); `@Exclude()` de `class-transformer` para transient fields.
- Cada entidad declara sus columnas comunes explícitamente. **Sin BaseEntity compartida** por defecto (cambiar solo si el proyecto destino la impone).
- Si la app maneja múltiples bases físicas, marcar con decorador custom (ej: `@Database('MyDbName')`) que use `Reflect.defineMetadata`.

```ts
@Entity({ name: 'Features', schema: 'dbo' })
export class Feature {
  @PrimaryGeneratedColumn({ name: 'Id' })
  id: number;

  @Column({ name: 'Name' })
  name: string;

  @Column({ type: 'datetime', default: () => 'GETDATE()', name: 'CreationDate' })
  creationDate: Date;

  @ManyToOne(() => Parent, { nullable: true })
  @JoinColumn({ name: 'ParentId' })
  parent: Parent;

  @OneToMany(() => Child, child => child.feature)
  children: Child[];

  @Exclude()
  password_match?: string;

  @BeforeInsert()
  @BeforeUpdate()
  async normalize() {
    // ...
  }
}
```
