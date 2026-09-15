// 新增待办入参校验
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

const CATEGORIES = ['work', 'study', 'life', 'shopping', 'health', 'social', 'other'];

export class CreateTodoDto {
  @IsString()
  @IsNotEmpty({ message: '待办内容不能为空' })
  @MaxLength(500)
  taskContent: string;

  @IsIn(CATEGORIES, { message: '待办分类不合法' })
  category: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  deadline?: string | null;

  /** 关联会话（接受建议加入计划时带上；手动添加为空） */
  @IsOptional()
  @IsInt()
  @Min(1)
  sessionId?: number | null;

  /** 迁移本地老数据时使用，正常流程不传（默认 false） */
  @IsOptional()
  @IsBoolean()
  done?: boolean;

  @IsOptional()
  @IsString()
  completedAt?: string | null;
}
