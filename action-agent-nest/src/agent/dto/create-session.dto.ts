// 创建会话（提交一次纠结）入参校验
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const CATEGORIES = ['work', 'study', 'life', 'shopping', 'health', 'social', 'other'];

export class CreateSessionDto {
  @IsString()
  @IsNotEmpty({ message: '请填写任务内容' })
  @MaxLength(500)
  taskContent: string;

  @IsIn(CATEGORIES, { message: '纠结分类不合法' })
  category: string;

  @IsInt()
  @Min(1)
  @Max(10)
  willScore: number;

  @IsInt()
  @Min(1)
  @Max(10)
  energyScore: number;

  @IsInt()
  @Min(1)
  @Max(10)
  importance: number;

  /** 预计耗时（分钟，可选） */
  @IsOptional()
  @IsInt()
  @Min(1)
  expectCostMin?: number | null;

  /** 截止时间（可选） */
  @IsOptional()
  @IsString()
  @MaxLength(50)
  deadline?: string | null;

  /** 地点（可选） */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  location?: string;

  @IsOptional()
  @IsBoolean()
  enableTarot?: boolean;

  @IsOptional()
  @IsBoolean()
  enableAnswerBook?: boolean;

  /** 补充条件（可选：一句话描述不全时补充背景/约束，空字符串视为无补充） */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  extraContext?: string;

  /** 今日天气·城市（勾选天气加成时必填） */
  @IsOptional()
  @IsString()
  @MaxLength(50)
  weatherCity?: string | null;

  /** 今日天气·摘要（后端天气接口返回的 summary 原样回传） */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  weatherText?: string | null;

  /** 用户对今日天气的打分 1-10 */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  weatherScore?: number | null;

  /** 消费购物·商品价格（元，可选；与 walletBalance 配合计算占比） */
  @IsOptional()
  @IsInt()
  @Min(1)
  itemPrice?: number | null;

  /** 消费购物·钱包余额（元，可选；与 itemPrice 配合计算占比） */
  @IsOptional()
  @IsInt()
  @Min(0)
  walletBalance?: number | null;

  /** 消费购物·钱包宽裕度 1-10（主观评估这笔消费对钱包的压力，越低越吃紧） */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  walletScore?: number | null;
}
