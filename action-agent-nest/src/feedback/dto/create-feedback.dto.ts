// 提交意见反馈入参
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateFeedbackDto {
  @IsString()
  @IsNotEmpty({ message: '反馈内容不能为空' })
  @MaxLength(1000, { message: '反馈内容不能超过 1000 字' })
  content: string;
}
