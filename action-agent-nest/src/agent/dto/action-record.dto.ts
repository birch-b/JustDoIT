// 提交行为反馈入参校验
import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class ActionRecordDto {
  @IsInt()
  sessionId: number;

  @IsBoolean()
  userAcceptSuggest: boolean;

  @IsBoolean()
  isExecute: boolean;

  @IsInt()
  @Min(0)
  actualCostMin: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  executeResult?: string;
}
