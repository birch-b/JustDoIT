// 忘记密码（邮箱验证码重置密码）入参校验
import { IsEmail, IsNotEmpty, IsString, Length } from 'class-validator';

export class ResetPasswordDto {
  @IsEmail({}, { message: '邮箱格式不正确' })
  @IsNotEmpty()
  email: string;

  @IsNotEmpty({ message: '请输入邮箱验证码' })
  code: string;

  @IsString()
  @IsNotEmpty()
  @Length(6, 30, { message: '新密码长度需在 6-30 位之间' })
  newPassword: string;
}
