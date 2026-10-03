// 更新个人资料入参校验：username/email/bio 均可选，至少传一个
import {
  IsString,
  IsOptional,
  Length,
  IsEmail,
  ValidateIf,
} from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @Length(3, 20, { message: '用户名长度需在 3-20 位之间' })
  username?: string;

  @IsOptional()
  @IsEmail({}, { message: '邮箱格式不正确' })
  email?: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== '')
  @IsString()
  @Length(0, 200, { message: '简介最多 200 字' })
  bio?: string;
}
