// JWT 鉴权守卫：加在 Controller 方法上，未携带有效 token 则返回 401
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
