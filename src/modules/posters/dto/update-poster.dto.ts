import { ApiProperty } from '@nestjs/swagger';

export class UpdatePosterDto {
  @ApiProperty({ description: 'Poster image file', type: 'string', format: 'binary' })
  image: any;
}