// 百度地图地点联想：输入关键词 → 返回地点名称 + 地址，用于地点可选搜索
// 用 place/v2/suggestion 而非 place/v2/search：search 在 region=全国 时只返回
// "各城市命中数量"的统计列表（result_type=city_type），拿不到具体门店
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface PlaceItem {
  name: string;
  address: string;
}

/** 百度 place/v2/suggestion 返回结构（只声明用到的字段） */
interface BaiduSuggestionRes {
  status: number;
  message?: string;
  result?: Array<{
    name: string;
    uid?: string;
    address?: string;
    city?: string;
  }>;
}

@Injectable()
export class PlaceService {
  private readonly logger = new Logger(PlaceService.name);

  constructor(private configService: ConfigService) {}

  /**
   * 关键词联想地点。召回策略按优先级：
   * 1. 有坐标 → region=全国 + location 按距离由近到远排序
   * 2. 无坐标有城市 → region=该城市，只召回本市 POI
   * 3. 都没有 → region=全国（结果离散，仅兜底）
   * @param keyword 用户输入，如"麦当劳"、"公司"
   * @param latInput 浏览器 WGS84 纬度（可选）
   * @param lngInput 浏览器 WGS84 经度（可选）
   * @param cityInput 城市名（可选，如"潮州"；天气功能 localStorage 里的上次选择）
   * @returns 地点列表；未配置 ak / 接口失败时返回 null，前端静默降级
   */
  async search(
    keyword: string,
    latInput?: number,
    lngInput?: number,
    cityInput?: string,
  ): Promise<PlaceItem[] | null> {
    const ak = this.configService.get<string>('map.baiduAk');
    if (!ak) {
      this.logger.warn('未配置 BAIDU_MAP_AK，跳过地点搜索');
      return null;
    }
    const q = keyword?.trim();
    if (!q || q.length < 1) return null;

    // 坐标合法（在中国范围内）时传给百度：suggestion 会按距离由近到远排序
    let locParam = '';
    const lat = Number(latInput);
    const lng = Number(lngInput);
    const hasCoords =
      Number.isFinite(lat) && Number.isFinite(lng) && lat >= 3 && lat <= 54 && lng >= 73 && lng <= 136;
    if (hasCoords) {
      locParam = `&location=${lat},${lng}&coordtype=wgs84ll`;
    }

    // 无坐标但有城市时缩小召回范围到该市；有坐标时保持全国+距离排序（跨城也能搜到）
    const city = cityInput?.trim().replace(/市$/, '') ?? '';
    const region = !hasCoords && city ? city : '全国';

    try {
      const url = `https://api.map.baidu.com/place/v2/suggestion?query=${encodeURIComponent(q)}`
        + `&region=${encodeURIComponent(region)}${locParam}&output=json&ak=${encodeURIComponent(ak)}`;
      const res = await fetch(url, { method: 'GET' });
      const json = (await res.json()) as BaiduSuggestionRes;
      if (json.status !== 0 || !Array.isArray(json.result)) {
        this.logger.warn(`百度地点联想失败 status=${json.status} msg=${json.message ?? ''}`);
        return null;
      }
      return json.result
        // 滤掉空壳联想项（用户输入原文回显，uid/地址全空）
        .filter((r) => r.uid || r.address)
        .map((r) => ({
          name: r.name,
          address: r.address || r.city || '',
        }))
        .slice(0, 10);
    } catch (err) {
      this.logger.error(`地点搜索异常: ${(err as Error).message}`);
      return null;
    }
  }
}
