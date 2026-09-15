// 更新待办入参：目前仅支持勾选完成状态
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateTodoDto {
  @IsOptional()
  @IsBoolean()
  done?: boolean;
}
