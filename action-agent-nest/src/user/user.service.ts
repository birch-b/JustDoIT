import { Injectable, ConflictException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { User } from './entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { VerifyCodeService } from './verify-code.service';
import { MailService } from './mail.service';
// 业务逻辑：

// 1. register：校验邮箱验证码，判断用户名/邮箱是否重复，bcrypt 哈希密码，保存用户
// 2. login：查询用户、比对密码，签发 JWT token 返回
// 3. sendCode：按 type（register/reset）生成验证码并发送邮件
// 4. resetPassword：校验 reset 类型验证码，更新密码
// 5. sendDeleteCode / deleteAccount：登录态 + delete 类型验证码注销账户
// 6. updateProfile：登录态下更新 username/email/bio（唯一性校验）
@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly verifyCodeService: VerifyCodeService,
    private readonly mailService: MailService,
  ) {}

  /** 统一构造对外的 user 响应对象（不含 password） */
  private toUserResponse(user: User) {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      bio: user.bio ?? '',
      createdAt: user.createAt
        ? new Date(user.createAt).toISOString()
        : null,
    };
  }

  /** 发送邮箱验证码：按 type 校验邮箱注册状态并下发 */
  async sendCode(dto: { email: string; type: 'register' | 'reset' }) {
    const user = await this.userRepo.findOne({ where: { email: dto.email } });

    if (dto.type === 'register' && user) {
      throw new ConflictException('该邮箱已被注册，请直接登录');
    }
    if (dto.type === 'reset' && !user) {
      throw new BadRequestException('该邮箱尚未注册');
    }

    const code = this.verifyCodeService.create(dto.type, dto.email);
    await this.mailService.sendVerifyCode(dto.email, code, dto.type);
    return { message: '验证码已发送，请查收邮件' };
  }

  /** 注册：校验邮箱验证码，校验用户名/邮箱唯一，bcrypt加密密码，保存用户 */
  async register(dto: RegisterDto) {
    // 校验注册类型验证码（type=register 的码，找回密码的码不通用）
    this.verifyCodeService.verify('register', dto.email, dto.code);

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
      user: this.toUserResponse(saved),
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
      user: this.toUserResponse(user),
    };
  }

  /** 忘记密码：校验 reset 类型验证码后更新密码 */
  async resetPassword(dto: { email: string; code: string; newPassword: string }) {
    const user = await this.userRepo.findOne({ where: { email: dto.email } });
    if (!user) {
      throw new BadRequestException('该邮箱尚未注册');
    }

    // 校验找回密码类型验证码（type=reset 的码，注册的码不通用）
    this.verifyCodeService.verify('reset', dto.email, dto.code);

    user.password = await bcrypt.hash(dto.newPassword, 10);
    await this.userRepo.save(user);
    return { message: '密码重置成功，请使用新密码登录' };
  }

  /** 发送注销账户验证码（需登录，验证码发往当前账号绑定邮箱） */
  async sendDeleteCode(userId: number) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }
    const code = this.verifyCodeService.create('delete', user.email);
    await this.mailService.sendVerifyCode(user.email, code, 'delete');
    return { message: '注销验证码已发送至账号绑定邮箱' };
  }

  /** 注销账户：校验 delete 类型验证码后删除用户，任务/会话/反馈由外键级联删除 */
  async deleteAccount(userId: number, code: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }
    // 校验注销类型验证码（注册/找回密码的码不通用，校验通过即一次性失效）
    this.verifyCodeService.verify('delete', user.email, code);

    await this.userRepo.delete(userId);
    return { message: '账户已注销' };
  }

  /**
   * 更新个人资料：登录态下修改 username/email/bio
   * - username/email 改动时做唯一性校验
   * - bio 允许传空串清空简介；未传字段不动原值
   * - 返回更新后的 user（不含 password）
   */
  async updateProfile(userId: number, dto: UpdateProfileDto) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }

    // username 唯一性校验（仅当传值且与原值不同时查重）
    if (dto.username !== undefined && dto.username !== user.username) {
      const exist = await this.userRepo.findOne({
        where: { username: dto.username },
      });
      if (exist) {
        throw new ConflictException('用户名已被占用');
      }
      user.username = dto.username;
    }

    // email 唯一性校验
    if (dto.email !== undefined && dto.email !== user.email) {
      const exist = await this.userRepo.findOne({
        where: { email: dto.email },
      });
      if (exist) {
        throw new ConflictException('邮箱已被注册');
      }
      user.email = dto.email;
    }

    // bio：传值就更新（包括空串），未传不动
    if (dto.bio !== undefined) {
      user.bio = dto.bio.trim();
    }

    const saved = await this.userRepo.save(user);
    return { user: this.toUserResponse(saved) };
  }
}
