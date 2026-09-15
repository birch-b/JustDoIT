// 创建会话（提交一次纠结）入参校验
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const CATEGORIES = ['work', 'study', 'life', 'shopping', 'health', 'social', 'other'];

export class CreateSessionDto {
  @IsString()
  @IsNotEmpty({ message: '请填写任务内容' })
  @MaxLength(500)
  taskContent: string;

  @IsIn(CATEGORIES, { message: '纠结分类不合法' })
  category: string;

  @IsInt()
  @Min(1)
  @Max(10)
  willScore: number;

  @IsInt()
  @Min(1)
  @Max(10)
  energyScore: number;

  @IsInt()
  @Min(1)
  @Max(10)
  importance: number;

  /** 预计耗时（分钟，可选） */
  @IsOptional()
  @IsInt()
  @Min(1)
  expectCostMin?: number | null;

  /** 截止时间（可选） */
  @IsOptional()
  @IsString()
  @MaxLength(50)
  deadline?: string | null;

  /** 地点（可选） */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  location?: string;

  @IsOptional()
  @IsBoolean()
  enableTarot?: boolean;

  @IsOptional()
  @IsBoolean()
  enableAnswerBook?: boolean;
}
