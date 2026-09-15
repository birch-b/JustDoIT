// 发送邮箱验证码入参校验
import { IsEmail, IsIn, IsNotEmpty } from 'class-validator';

export class SendCodeDto {
  @IsEmail({}, { message: '邮箱格式不正确' })
  @IsNotEmpty()
  email: string;

  /** 验证码用途状态字段：register=注册账号 / reset=找回密码，后端据此区分场景 */
  @IsIn(['register', 'reset'], { message: '验证码用途不合法' })
  type: 'register' | 'reset';
}
