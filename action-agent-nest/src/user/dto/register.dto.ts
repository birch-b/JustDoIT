// 注册入参校验
import { IsString, IsNotEmpty, Length, IsEmail } from 'class-validator';

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  @Length(3, 20)
  username: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @Length(6, 30)
  password: string;

  @IsString()
  @IsNotEmpty({ message: '请输入邮箱验证码' })
  code: string;
}
