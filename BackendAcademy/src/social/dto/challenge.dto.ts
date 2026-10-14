import { IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateChallengeDto {
  @IsString()
  @IsNotEmpty()
  challengeId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(140)
  title: string;

  /** Bonus pot in stroops. Integer because a stroop is indivisible. */
  @IsInt()
  @Min(0)
  potStroops: number;

  /** Maximum allowed submission attempts per user (defaults to 3). */
  @IsOptional()
  @IsInt()
  @Min(1)
  maxAttempts?: number;
}

export class SubmitChallengeDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  submissionId: string;
}

export class VoteDto {
  @IsString()
  @IsNotEmpty()
  voterId: string;

  @IsString()
  @IsNotEmpty()
  submissionId: string;
}
