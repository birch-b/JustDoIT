// 更新一条用户记忆入参校验：全字段可选，未传字段不更新
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
import { MEMORY_TYPES } from './create-memory.dto';

export class UpdateMemoryDto {
  @IsOptional()
  @IsIn(MEMORY_TYPES, {
    message: 'memoryType 必须是 preference/behavior/pattern/goal',
  })
  memoryType?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: '记忆内容不能为空' })
  @MaxLength(500, { message: '记忆内容最多 500 字' })
  content?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  confidence?: number;
}
