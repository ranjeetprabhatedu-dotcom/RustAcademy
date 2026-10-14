import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min, ValidateIf } from 'class-validator';
import { TutorDecision } from '../grading.types';

export class TutorReviewDto {
  /**
   * The reviewing tutor's id. There is no auth guard in BackendAcademy yet, so
   * identity is carried on the request body (as elsewhere in this service); it
   * is still recorded verbatim on the override for auditability.
   */
  @IsString()
  @IsNotEmpty()
  tutorId: string;

  @IsIn(['confirm', 'override'])
  decision: TutorDecision;

  /** Required for an override: the tutor's replacement score (0 to 100). */
  @ValidateIf((dto: TutorReviewDto) => dto.decision === 'override' || dto.score !== undefined)
  @IsInt()
  @Min(0)
  @Max(100)
  score?: number;

  /** Required for an override: why the AI pre-score was changed. */
  @ValidateIf((dto: TutorReviewDto) => dto.decision === 'override' && !dto.feedback)
  @IsString()
  @IsNotEmpty()
  reason?: string;

  /** Tutor review feedback for the learner or review audit. */
  @ValidateIf((dto: TutorReviewDto) => (dto.decision === 'override' && !dto.reason) || dto.feedback !== undefined)
  @IsString()
  @IsNotEmpty()
  feedback?: string;
}
