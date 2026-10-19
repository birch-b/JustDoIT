// 完成打卡入参：感受可选
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ReflectTodoDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}
