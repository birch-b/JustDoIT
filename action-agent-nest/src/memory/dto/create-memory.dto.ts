// 创建一条用户记忆入参校验
import {
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const MEMORY_TYPES = ['preference', 'behavior', 'pattern', 'goal'] as const;

export class CreateMemoryDto {
  @IsIn(MEMORY_TYPES, {
    message: 'memoryType 必须是 preference/behavior/pattern/goal',
  })
  memoryType: string;

  @IsString()
  @IsNotEmpty({ message: '请填写记忆内容' })
  @MaxLength(500, { message: '记忆内容最多 500 字' })
  content: string;

  /** 置信度 0-1，可选，缺省 0.5 */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  confidence?: number;
}
