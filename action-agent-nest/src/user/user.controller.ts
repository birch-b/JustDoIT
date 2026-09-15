import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { UserService } from './user.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { SendCodeDto } from './dto/send-code.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { GetUser } from '../common/decorators/get-user.decorator';
//暴露接口
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  /** 发送邮箱验证码 POST /api/user/send-code，type 区分注册/找回密码 */
  @Post('send-code')
  async sendCode(@Body() dto: SendCodeDto) {
    return this.userService.sendCode(dto);
  }

  /** 注册接口 POST /api/user/register（需邮箱验证码） */
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.userService.register(dto);
  }

  /** 登录接口 POST /api/user/login */
  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.userService.login(dto);
  }

  /** 忘记密码-重置密码 POST /api/user/reset-password（需邮箱验证码） */
  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.userService.resetPassword(dto);
  }

  /** 发送注销账户验证码 POST /api/user/send-delete-code（需登录，发往绑定邮箱） */
  @UseGuards(JwtAuthGuard)
  @Post('send-delete-code')
  async sendDeleteCode(@GetUser('userId') userId: number) {
    return this.userService.sendDeleteCode(userId);
  }

  /** 注销账户 POST /api/user/delete-account（需登录 + delete 类型邮箱验证码） */
  @UseGuards(JwtAuthGuard)
  @Post('delete-account')
  async deleteAccount(
    @GetUser('userId') userId: number,
    @Body() dto: DeleteAccountDto,
  ) {
    return this.userService.deleteAccount(userId, dto.code);
  }
}
