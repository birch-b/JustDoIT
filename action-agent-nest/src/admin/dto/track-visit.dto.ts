// 访问上报入参：登录用户前端也会带 visitorId，后台按 userId 是否为空区分两类访问
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class TrackVisitDto {
  /** 浏览器游客标识（前端 localStorage 生成） */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  visitorId?: string;
}
