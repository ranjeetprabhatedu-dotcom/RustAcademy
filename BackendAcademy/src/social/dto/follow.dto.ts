import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class FollowDto {
  @ApiProperty({ example: 'learner-1', description: 'The user initiating the follow' })
  @IsString()
  @IsNotEmpty()
  followerId: string;

  @ApiProperty({ example: 'tutor-1', description: 'The user being followed' })
  @IsString()
  @IsNotEmpty()
  followeeId: string;
}
