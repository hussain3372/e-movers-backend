import { IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePosterDto {
  @ApiProperty({ description: 'Poster image file', type: 'string', format: 'binary' })
  @IsNotEmpty()
  image: any;
}