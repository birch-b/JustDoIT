// 公告新建/编辑入参
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

class AnnouncementItemDto {
  @IsIn(['new', 'improve', 'fix'], { message: '条目类型必须是 new/improve/fix' })
  type: 'new' | 'improve' | 'fix';

  @IsString()
  @IsNotEmpty({ message: '条目内容不能为空' })
  @MaxLength(200, { message: '单条内容不能超过 200 字' })
  text: string;
}

export class UpsertAnnouncementDto {
  @IsString()
  @IsNotEmpty({ message: '标题不能为空' })
  @MaxLength(50, { message: '标题不能超过 50 字' })
  title: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: '日期格式必须是 YYYY-MM-DD' })
  date: string;

  @IsArray()
  @ArrayMinSize(1, { message: '至少需要一条内容' })
  @ValidateNested({ each: true })
  @Type(() => AnnouncementItemDto)
  items: AnnouncementItemDto[];
}
