import { Body, Controller, Post } from '@nestjs/common';
import { UserService } from './user.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
//暴露接口
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  /** 注册接口 POST /api/user/register */
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.userService.register(dto);
  }

  /** 登录接口 POST /api/user/login */
  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.userService.login(dto);
  }
}
