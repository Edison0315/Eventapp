import { Transform } from 'class-transformer';
import { IsEmail, IsString, IsUrl, Length, MaxLength } from 'class-validator';

export class CreatePlaceDto {
  @IsString()
  @Length(2, 120)
  name: string;

  @IsString()
  @Length(1, 200)
  address: string;

  @IsUrl()
  @MaxLength(300)
  ubication: string;

  @IsEmail()
  @Transform(({ value }) => (typeof value === 'string' ? value.toLowerCase().trim() : value))
  email: string;

  @IsString()
  @Length(6, 20)
  phone: string;
}
