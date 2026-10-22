// 更新用户偏好问卷入参：preference 为前端传入的结构化对象，后端原样持久化
import { IsObject, IsNotEmpty } from 'class-validator';

export class UpdatePreferenceDto {
  @IsObject({ message: '偏好数据必须是对象' })
  @IsNotEmpty({ message: '偏好数据不能为空' })
  preference: Record<string, unknown>;
}
