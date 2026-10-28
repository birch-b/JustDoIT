// 游客会话迁移导入：登录成功后把浏览器本地数据原样写入当前用户名下
// 禁止走 createSession（会重新调 LLM 产生不同结果），此处只落库不计算
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { CreateSessionDto } from './create-session.dto';

/** 会话计算结果（AgentSessionRes 去掉 sessionId，由后端重新发号） */
class GuestSessionDataDto {
  @IsInt()
  @Min(0)
  @Max(100)
  agentSuggestIndex: number;

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

  @IsOptional()
  @IsString()
  @MaxLength(50)
  taroCard?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tarotCards?: string[] | null;

  @IsOptional()
  @IsString()
  tarotReading?: string | null;

  @IsOptional()
  @IsString()
  answerBook?: string | null;

  @IsOptional()
  @IsString()
  answerBookReading?: string | null;
}

/** 行为反馈（可无）；游客无 LLM 二次回复，agentReply 一般为空 */
class GuestRecordDataDto {
  @IsBoolean()
  userAcceptSuggest: boolean;

  @IsOptional()
  @IsBoolean()
  addToTodo?: boolean;

  @IsBoolean()
  isExecute: boolean;

  @IsInt()
  @Min(0)
  actualCostMin: number;

  @IsOptional()
  @IsString()
  executeResult?: string;

  @IsOptional()
  @IsString()
  feedbackComment?: string | null;

  @IsOptional()
  @IsString()
  agentReply?: string | null;
}

class GuestSessionItemDto {
  /** 游客本地负数会话 ID，用于返回新旧 ID 映射 */
  @IsInt()
  oldId: number;

  @ValidateNested()
  @Type(() => CreateSessionDto)
  task: CreateSessionDto;

  @ValidateNested()
  @Type(() => GuestSessionDataDto)
  session: GuestSessionDataDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => GuestRecordDataDto)
  record?: GuestRecordDataDto | null;

  /** 本地创建时间 ISO 串，导入时保留原时间 */
  @IsOptional()
  @IsString()
  createdAt?: string;
}

export class ImportGuestSessionsDto {
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => GuestSessionItemDto)
  items: GuestSessionItemDto[];
}
