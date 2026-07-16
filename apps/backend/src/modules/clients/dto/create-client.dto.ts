import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, IsUrl, Length, MaxLength } from 'class-validator';

export class CreateClientDto {
  @IsString()
  @Length(2, 120)
  name: string;

  @IsString()
  @Length(1, 40)
  nro_doc: string;

  @IsString()
  @Length(1, 200)
  address: string;

  @IsString()
  @Length(1, 200)
  ubication: string;

  @IsEmail()
  @Transform(({ value }) => (typeof value === 'string' ? value.toLowerCase().trim() : value))
  email: string;

  @IsOptional()
  @IsUrl()
  @MaxLength(200)
  web?: string | null;
}
