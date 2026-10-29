// 提交意见反馈入参：登录用户走 userId，游客靠 visitorId 识别身份
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateFeedbackDto {
  @IsString()
  @IsNotEmpty({ message: '反馈内容不能为空' })
  @MaxLength(1000, { message: '反馈内容不能超过 1000 字' })
  content: string;

  /** 浏览器游客标识（游客必带；登录用户可不带） */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  visitorId?: string;
}
