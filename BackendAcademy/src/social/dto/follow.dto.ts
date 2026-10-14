import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class FollowDto {
  @ApiProperty({ example: 'learner-1', description: 'The user initiating the follow request' })
  @IsString()
  @IsNotEmpty()
  followerId: string;

  @ApiProperty({ example: 'tutor-1', description: 'The target user to follow (must not be self)' })
  @IsString()
  @IsNotEmpty()
  followeeId: string;
}

export interface SelfFollowError {
  code: 'CANNOT_FOLLOW_SELF';
  message: string;
}
