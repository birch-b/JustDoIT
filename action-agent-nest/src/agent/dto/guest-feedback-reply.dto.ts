// 游客反馈二次回复入参：会话不落库，上下文由前端随请求带回
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class GuestFeedbackReplyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  taskContent: string;

  @IsString()
  @MaxLength(20)
  category: string;

  @IsString()
  @IsNotEmpty()
  conclusion: string;

  @IsString()
  @MaxLength(20)
  persuadeMode: string;

  @IsString()
  persuadeText: string;

  @IsString()
  minAction: string;

  /** 用户是否接受建议 */
  @IsBoolean()
  accepted: boolean;

  /** 是否加入计划表 */
  @IsBoolean()
  addToTodo: boolean;

  /** 用户留言（可空） */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}

export class GuestCheckinReplyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  taskContent: string;

  @IsString()
  @MaxLength(20)
  category: string;

  /** 打卡感受（可空） */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}
