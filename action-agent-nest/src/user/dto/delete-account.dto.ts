// 注销账户入参校验（需登录态 + 邮箱验证码）
import { IsNotEmpty, IsString } from 'class-validator';

export class DeleteAccountDto {
  @IsString()
  @IsNotEmpty({ message: '请输入邮箱验证码' })
  code: string;
}
