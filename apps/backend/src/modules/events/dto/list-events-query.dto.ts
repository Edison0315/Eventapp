import { Status } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsISO8601, IsOptional, Min } from 'class-validator';
import { IsAfterField } from '../../../common/validators/is-after-field.validator';

export class ListEventsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  clientId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  placeId?: number;

  @IsOptional()
  @IsISO8601()
  from?: string;

  // Ademas de ISO8601, valida que `to` sea posterior a `from` (Risk de la spec:
  // filtro from/to mal parseado da resultado incoherente sin error -> 400 aqui).
  @IsOptional()
  @IsISO8601()
  @IsAfterField('from')
  to?: string;

  @IsOptional()
  @IsIn(['activo', 'inactivo'])
  status?: Status;
}
