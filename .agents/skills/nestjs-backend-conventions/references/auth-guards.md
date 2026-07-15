# Guards y decoradores de auth

> Volver a [SKILL.md](../SKILL.md)

## Guard JWT global

```ts
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) { super(); }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(
      IS_PUBLIC_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (isPublic) return true;
    return super.canActivate(context);
  }

  handleRequest(err: any, payload: any, info: any) {
    if (err || !payload) {
      throw new ForbiddenException(`${info?.message ?? 'Error in authentication'}`);
    }
    return payload;
  }
}
```

Registro en `AppModule`:

```ts
providers: [
  { provide: APP_GUARD, useClass: JwtAuthGuard },
],
```

## Decorador `@Public()`

```ts
// src/common/guards/is-public/is-public.guard.ts
import { SetMetadata } from '@nestjs/common';
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

Aplicado sobre handlers que deban bypasear auth:

```ts
@Public()
@Post('login')
login(@Body() dto: CreateAuthDto) { ... }
```

## Passport strategy

```ts
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly userService: UsersService,
    cfg: ConfigService,
  ) {
    super({
      secretOrKey: cfg.get<string>('JWT_SECRET') as string,
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.userService.findOneByEmail(payload.login);
    if (!user) throw new UnauthorizedException('User not found, invalid token');
    return { ...user, ...payload };
  }
}
```

Módulo:

```ts
imports: [
  PassportModule.register({ defaultStrategy: 'jwt' }),
  JwtModule.registerAsync({
    imports: [ConfigModule],
    inject: [ConfigService],
    useFactory: async cfg => ({ secret: cfg.get<string>('JWT_SECRET') }),
  }),
],
```

## Custom param decorators

```ts
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest().user,
);
```

Regla: **no lanzar `HttpException` desde `createParamDecorator`**; si necesitas validar, hazlo en un guard.
