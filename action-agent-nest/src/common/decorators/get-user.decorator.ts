// 自定义装饰器：在 Controller 方法参数上用 @GetUser() 直接获取登录用户
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const GetUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user; // JwtStrategy.validate 的返回值
    return data ? user?.[data] : user;
  },
);
