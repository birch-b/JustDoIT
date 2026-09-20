// 批量删除会话入参校验
import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt, Min } from 'class-validator';

export class BatchDeleteSessionsDto {
  @IsArray({ message: 'ids 必须是数组' })
  @ArrayMinSize(1, { message: '至少选择一条记录' })
  @ArrayMaxSize(100, { message: '一次最多删除 100 条' })
  @IsInt({ each: true, message: '会话 id 必须是整数' })
  @Min(1, { each: true })
  ids: number[];
}
