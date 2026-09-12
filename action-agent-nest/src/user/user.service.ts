import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { User } from './entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
// 业务逻辑：

// 1. register：判断用户名是否重复，bcrypt 哈希密码，保存用户
// 2. login：查询用户、比对密码，签发 JWT token 返回
@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  /** 注册：校验用户名/邮箱唯一，bcrypt加密密码，保存用户 */
  async register(dto: RegisterDto) {
    // 检查用户名是否已存在
    const existUsername = await this.userRepo.findOne({
      where: { username: dto.username },
    });
    if (existUsername) {
      throw new ConflictException('用户名已被占用');
    }

    // 检查邮箱是否已存在
    const existEmail = await this.userRepo.findOne({
      where: { email: dto.email },
    });
    if (existEmail) {
      throw new ConflictException('邮箱已被注册');
    }

    // bcrypt 加密密码
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    // 保存用户
    const user = this.userRepo.create({
      username: dto.username,
      email: dto.email,
      password: hashedPassword,
    });
    const saved = await this.userRepo.save(user);

    // 签发 JWT
    const token = this.jwtService.sign({
      userId: saved.id,
      username: saved.username,
    });

    return {
      token,
      user: {
        id: saved.id,
        username: saved.username,
        email: saved.email,
      },
    };
  }

  /** 登录：查询用户、比对密码、签发JWT */
  async login(dto: LoginDto) {
    // 支持用户名或邮箱登录
    const user = await this.userRepo.findOne({
      where: [
        { username: dto.username },
        { email: dto.username },
      ],
    });
    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }

    // 比对密码
    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('密码错误');
    }

    // 签发 JWT
    const token = this.jwtService.sign({
      userId: user.id,
      username: user.username,
    });

    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
    };
  }
}
