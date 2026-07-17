import { IsInt, IsISO8601, IsOptional, IsString, Length, Min } from 'class-validator';
import { IsAfterField } from '../../../common/validators/is-after-field.validator';
import { IsFutureDate } from '../../../common/validators/is-future-date.validator';

export class CreateEventDto {
  @IsString()
  @Length(2, 150)
  name: string;

  @IsInt()
  @Min(1)
  clientId: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  placeId?: number;

  @IsISO8601()
  @IsFutureDate()
  dateStart: string;

  @IsISO8601()
  @IsAfterField('dateStart')
  dateEnd: string;

  @IsString()
  @Length(2, 150)
  typeEvent: string;
}
