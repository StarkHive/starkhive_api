import { IsBoolean, IsOptional } from 'class-validator';

export class CreatePreferencesDto {
  @IsOptional()
  @IsBoolean()
  application?: boolean = true;

  @IsOptional()
  @IsBoolean()
  reviews?: boolean = true;

  @IsOptional()
  @IsBoolean()
  posts?: boolean = true;

  @IsOptional()
  @IsBoolean()
  tasks?: boolean = true;
}
