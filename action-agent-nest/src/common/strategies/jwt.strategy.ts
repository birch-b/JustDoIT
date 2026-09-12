// JWT 解析策略：从请求头 Authorization: Bearer <token> 解析出 userId
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

export interface JwtPayload {
  userId: number;
  username: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      // 从 Authorization: Bearer xxx 中提取 token
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      // 不校验过期时间（过期会直接 401）
      ignoreExpiration: false,
      // 从 .env 读取密钥
      secretOrKey: configService.get<string>('jwt.secret')!,
    });
  }

  // 解析成功后，返回值会挂载到 req.user 上
  async validate(payload: JwtPayload) {
    return { userId: payload.userId, username: payload.username };
  }
}
