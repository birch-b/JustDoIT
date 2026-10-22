// 可选 JWT 守卫：有合法 token 则解析出 user，无 token 或 token 非法不报错、user 为 null
// 用于「访问上报」这类登录匿名都可以的公开接口
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OptionalJwtGuard extends AuthGuard('jwt') {
  handleRequest<TUser = any>(_err: any, user: TUser, _info?: any, _context?: any): TUser | null {
    return user ?? null;
  }
}
