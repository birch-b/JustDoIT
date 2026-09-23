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

  /** 用户的可选评论/想说的话（反馈决策时填写；执行回写不带此字段则保留原值） */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;

  /** 接受建议后是否加入计划表（仅在用户做出决定的那次反馈中给出） */
  @IsOptional()
  @IsBoolean()
  addToTodo?: boolean;

  /** 是否需要 Agent 二次回复：仅用户点接受/拒绝的那次反馈为 true，计划表勾选执行回写为 false/缺省 */
  @IsOptional()
  @IsBoolean()
  withReply?: boolean;
}
