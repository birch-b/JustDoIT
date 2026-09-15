import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { User } from './entities/user.entity';
import { MailService } from './mail.service';
import { VerifyCodeService } from './verify-code.service';
//注册 TypeORM 实体，异步引入 JwtModule
@Module({
  imports: [
    // 注册 User 实体，Service 里才能用 @InjectRepository 注入
    TypeOrmModule.forFeature([User]),
    // PassportModule 让模块内的 JwtAuthGuard 能解析 AuthModuleOptions
    PassportModule.register({ defaultStrategy: 'jwt' }),
    // 异步引入 JwtModule，从 .env 读取 secret 和过期时间
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.secret'),
        signOptions: {
          expiresIn: config.get<string>('jwt.expiresIn') as any,
        },
      }),
    }),
  ],
  controllers: [UserController],
  providers: [UserService, MailService, VerifyCodeService],
})
export class UserModule {}
