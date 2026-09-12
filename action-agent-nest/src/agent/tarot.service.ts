// 塔罗牌 API 封装：妖狐 API 单张抽牌
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface TarotCard {
  cardName: string;
  orientation: string; // 正位 / 逆位
  keywords: string;
  description: string;
  advice: string;
  imageUrl: string;
}

export interface TarotResult {
  cards: TarotCard[];
  summary: string;   // 综合解读
  oracle: string;    // 塔罗神谕
}

interface YaohuTarotRes {
  code: number;
  msg: string;
  data: {
    name: string;
    name_cn: string;
    name_en: string;
    positive: string;   // 正位关键词
    negative: string;   // 逆位关键词
    index: number;
    is_positive: boolean;
    description: string;
    image_url: string;
  } | null;
}

@Injectable()
export class TarotService {
  private readonly logger = new Logger(TarotService.name);
  private readonly apiUrl = 'https://api.yaohud.cn/api/v6/tarot_cards/api';

  /** 抽牌张数：单张（有放回随机，抽多张会重复） */
  private readonly SPREAD_COUNT = 1;

  constructor(private configService: ConfigService) {}

  /**
   * 抽塔罗牌（单张）
   * @param _topicId 旧接口遗留参数（妖狐接口无主题概念），保留签名兼容
   * @returns 塔罗牌结果，失败时返回 null
   */
  async draw(_topicId: number = 5): Promise<TarotResult | null> {
    const apiKey = this.configService.get<string>('tarot.apiKey');
    if (!apiKey) {
      this.logger.warn('未配置塔罗牌 API_KEY，跳过抽牌');
      return null;
    }

    try {
      const results = await Promise.all(
        Array.from({ length: this.SPREAD_COUNT }, () => this.drawOne(apiKey)),
      );
      const cards = results.filter((c): c is TarotCard => c !== null);

      if (cards.length < this.SPREAD_COUNT) {
        this.logger.error(`塔罗牌抽牌不完整：${cards.length}/${this.SPREAD_COUNT}`);
        return null;
      }

      return {
        cards,
        summary: '',
        oracle: '',
      };
    } catch (err) {
      this.logger.error(`塔罗牌调用失败: ${(err as Error).message}`);
      return null;
    }
  }

  /** 抽单张牌并映射为统一结构；失败返回 null */
  private async drawOne(apiKey: string): Promise<TarotCard | null> {
    const res = await fetch(`${this.apiUrl}?key=${apiKey}`, { method: 'GET' });
    if (!res.ok) {
      this.logger.error(`塔罗牌请求失败: ${res.status}`);
      return null;
    }

    const data = (await res.json()) as YaohuTarotRes;
    if (data.code !== 200 || !data.data) {
      this.logger.error(`塔罗牌接口返回错误: ${data.msg}`);
      return null;
    }

    const d = data.data;
    return {
      cardName: d.name_cn || d.name,
      orientation: d.is_positive ? '正位' : '逆位',
      keywords: d.is_positive ? d.positive : d.negative,
      description: d.description,
      advice: '',
      imageUrl: d.image_url,
    };
  }
}
