// 全国城市列表：代理 mxnzp.com /api/address/list（省→市两级，区级不取）
// app_secret 只能存后端；行政区划是静态数据，内存缓存 7 天，失败时返回 null 让前端回退内置城市
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** 省 → 其下地级市列表（城市名已去掉"市"后缀） */
export interface CityGroup {
  /** 省份展示名（已去掉省/自治区等后缀，如"河北""内蒙古""广西"） */
  name: string;
  cities: string[];
}

interface MxnzpRes {
  code: number;
  msg?: string;
  data?: Array<{
    name?: string;
    pchilds?: Array<{ name?: string }>;
  }>;
}

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** 直辖市/特区名单：mxnzp 数据里这些省份的城市字段是"市辖区"或不可用，归一为省份名本身作城市 */
const MUNICIPALITIES: Record<string, string> = {
  北京市: '北京', 天津市: '天津', 上海市: '上海', 重庆市: '重庆',
};

@Injectable()
export class CityService {
  private readonly logger = new Logger(CityService.name);
  private cache: { groups: CityGroup[]; ts: number } | null = null;
  /** 并发请求去重，避免缓存击穿时连打多次第三方 */
  private inflight: Promise<CityGroup[] | null> | null = null;

  constructor(private configService: ConfigService) {}

  /** 获取省→市分组；未配置凭证/接口失败/数据异常时返回 null */
  async getCityGroups(): Promise<CityGroup[] | null> {
    if (this.cache && Date.now() - this.cache.ts < CACHE_TTL_MS) return this.cache.groups;
    if (this.inflight) return this.inflight;

    this.inflight = this.fetchGroups().finally(() => {
      this.inflight = null;
    });
    return this.inflight;
  }

  private async fetchGroups(): Promise<CityGroup[] | null> {
    const appId = this.configService.get<string>('city.appId');
    const appSecret = this.configService.get<string>('city.appSecret');
    if (!appId || !appSecret) {
      this.logger.warn('未配置 MXNZP_APP_ID/MXNZP_APP_SECRET，城市列表回退内置数据');
      return null;
    }

    try {
      const url = `https://www.mxnzp.com/api/address/list?app_id=${encodeURIComponent(appId)}`
        + `&app_secret=${encodeURIComponent(appSecret)}`;
      const res = await fetch(url, { method: 'GET' });
      const json = (await res.json()) as MxnzpRes;
      if (json.code !== 1 || !Array.isArray(json.data)) {
        this.logger.warn(`城市列表接口异常 code=${json.code} msg=${json.msg ?? ''}`);
        return null;
      }

      const groups: CityGroup[] = [];
      for (const prov of json.data) {
        const provName = (prov.name ?? '').trim();
        // 直辖市：城市字段是"市辖区"，直接用省名作唯一城市
        if (provName in MUNICIPALITIES) {
          groups.push({ name: MUNICIPALITIES[provName], cities: [MUNICIPALITIES[provName]] });
          continue;
        }
        // 港澳台：天气接口覆盖不到（whyta 是国内 API），整组跳过
        if (/^(中国台湾|中国香港|中国澳门|澳门|香港|台湾)$/u.test(provName)) continue;
        if (!Array.isArray(prov.pchilds) || prov.pchilds.length === 0) continue;
        const seen = new Set<string>();
        const cities: string[] = [];
        for (const c of prov.pchilds) {
          const name = (c.name ?? '').trim().replace(/市$/u, '');
          // 过滤市辖区/省直辖县级市等不可查询条目
          if (name === '市辖区' || !name || seen.has(name)) continue;
          seen.add(name);
          cities.push(name);
        }
        if (cities.length > 0) groups.push({ name: this.normalizeProvince(provName), cities });
      }
      if (groups.length === 0) return null;

      this.cache = { groups, ts: Date.now() };
      return groups;
    } catch (err) {
      this.logger.error(`城市列表查询失败: ${(err as Error).message}`);
      return null;
    }
  }

  /** "河北省"→"河北"、"内蒙古自治区"→"内蒙古"、"广西壮族自治区"→"广西"、"北京市"→"北京" */
  private normalizeProvince(raw: string): string {
    return raw.trim().replace(/(省|市|壮族自治区|回族自治区|维吾尔自治区|自治区|特别行政区)$/u, '');
  }
}
