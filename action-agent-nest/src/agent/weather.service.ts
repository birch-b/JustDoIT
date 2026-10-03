// 天气 API 封装：whyta.cn 我的天气（实时天气）
// 前端勾选"今日天气"后先调 GET /agent/weather 展示天气并让用户打分，天气+打分随会话提交注入 prompt
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** 归一化后的天气信息（summary 已拼好，前端可直接展示，也随会话入库） */
export interface WeatherInfo {
  city: string;
  weatherDesc: string;
  tempC: string;
  feelsLikeC: string;
  humidity: string;
  windText: string;
  /** 展示/入库摘要：小雨 · 22℃（体感21℃） · 湿度70% · 东风 8km/h */
  summary: string;
}

/** whyta 接口原始返回（宽松定义，实际包裹层做兼容解析） */
interface WhytaWeatherRes {
  city?: string;
  FeelsLikeC?: string;
  temp_C?: string;
  // 官方文档里 weatherDesc 是 [{ value: "晴" }] 数组；早期/其他版本可能直接给字符串，两种都兼容
  weatherDesc?: string | Array<{ value?: string }>;
  humidity?: string;
  precipMM?: string;
  winddir16Point?: string;
  windspeedKmph?: string;
  // 常见外层包裹：官方为 { status, message, data }，也兼容 result
  data?: WhytaWeatherRes;
  result?: WhytaWeatherRes;
  status?: number | string;
  message?: string;
  code?: number | string;
  msg?: string;
}

/** 百度逆地理编码返回（只声明用到的字段；city 个别场景为空数组或空串） */
interface BaiduRegeoRes {
  status: number;
  message?: string;
  result?: {
    addressComponent?: {
      country?: string;
      province?: string;
      city?: string | string[];
    };
  };
}

/** 常用城市中文名 → API 接受的英文/拼音名；不在表内的输入原样透传（接口可能本身支持中文） */
const CITY_MAP: Record<string, string> = {
  北京: 'Beijing',
  上海: 'Shanghai',
  广州: 'Guangzhou',
  深圳: 'Shenzhen',
  天津: 'Tianjin',
  重庆: 'Chongqing',
  成都: 'Chengdu',
  杭州: 'Hangzhou',
  南京: 'Nanjing',
  武汉: 'Wuhan',
  西安: "Xi'an",
  苏州: 'Suzhou',
  郑州: 'Zhengzhou',
  长沙: 'Changsha',
  青岛: 'Qingdao',
  大连: 'Dalian',
  宁波: 'Ningbo',
  厦门: 'Xiamen',
  福州: 'Fuzhou',
  合肥: 'Hefei',
  南昌: 'Nanchang',
  济南: 'Jinan',
  昆明: 'Kunming',
  贵阳: 'Guiyang',
  南宁: 'Nanning',
  太原: 'Taiyuan',
  石家庄: 'Shijiazhuang',
  哈尔滨: 'Harbin',
  长春: 'Changchun',
  沈阳: 'Shenyang',
  兰州: 'Lanzhou',
  海口: 'Haikou',
  三亚: 'Sanya',
  乌鲁木齐: 'Urumqi',
  呼和浩特: 'Hohhot',
  银川: 'Yinchuan',
  西宁: 'Xining',
  拉萨: 'Lhasa',
  无锡: 'Wuxi',
  佛山: 'Foshan',
  东莞: 'Dongguan',
  珠海: 'Zhuhai',
  温州: 'Wenzhou',
};

/** 天气描述英文 → 中文（接口实际返回英文如 Overcast/Sunny；不在表内原样保留） */
const WEATHER_DESC: Record<string, string> = {
  Sunny: '晴', Clear: '晴', 'Partly cloudy': '多云', Cloudy: '多云转阴',
  Overcast: '阴', Mist: '薄雾', Fog: '雾', 'Freezing fog': '冻雾',
  'Patchy rain possible': '零星小雨', 'Patchy rain nearby': '零星小雨',
  'Light drizzle': '毛毛雨',
  'Light rain': '小雨', 'Patchy light rain': '零星小雨', 'Moderate rain': '中雨',
  'Heavy rain': '大雨', 'Torrential rain shower': '暴雨',
  'Light rain shower': '小阵雨', 'Moderate or heavy rain shower': '强阵雨',
  Thunderstorm: '雷阵雨', 'Thundery outbreaks possible': '局部雷雨',
  'Patchy light rain with thunder': '雷阵雨',
  'Light snow': '小雪', 'Patchy snow possible': '零星小雪', 'Moderate snow': '中雪',
  'Patchy moderate snow': '中雪', 'Heavy snow': '大雪', 'Patchy heavy snow': '大雪',
  'Snow flurries': '阵雪', 'Light snow showers': '小阵雪',
  'Moderate or heavy snow showers': '强阵雪', Blizzard: '暴雪', 'Blowing snow': '风吹雪',
  Sleet: '雨夹雪', 'Light sleet': '小雨夹雪', 'Patchy sleet possible': '零星雨夹雪',
  'Moderate or heavy sleet': '强雨夹雪', 'Light sleet showers': '小阵雨夹雪',
  'Moderate or heavy sleet showers': '强阵雨夹雪',
  'Heavy rain at times': '间歇性大雨', 'Moderate rain at times': '间歇性中雨',
  'Light rain at times': '间歇性小雨', Drizzle: '毛毛雨', 'Patchy light drizzle': '零星毛毛雨',
  Haze: '霾', 'Smoky haze': '灰霾', Smoke: '烟雾', 'Volcanic ash': '火山灰',
  Dust: '浮尘', 'Dust storms': '沙尘暴', 'Sandstorm': '沙尘暴', 'Blowing sand': '扬沙',
};

/** 16 方位风向英文 → 中文 */
const WIND_DIR: Record<string, string> = {
  N: '北风', NNE: '北偏东风', NE: '东北风', ENE: '东偏北风',
  E: '东风', ESE: '东偏南风', SE: '东南风', SSE: '南偏东风',
  S: '南风', SSW: '南偏西风', SW: '西南风', WSW: '西偏南风',
  W: '西风', WNW: '西偏北风', NW: '西北风', NNW: '北偏西风',
};

@Injectable()
export class WeatherService {
  private readonly logger = new Logger(WeatherService.name);
  private readonly apiUrl = 'https://whyta.cn/api/tianqi';

  constructor(private configService: ConfigService) {}

  /**
   * 查询某城市实时天气。
   * @param cityInput 用户输入的城市（中文或英文）
   * @returns 归一化天气信息；未配置 key、网络或接口失败时返回 null
   */
  async getWeather(cityInput: string): Promise<WeatherInfo | null> {
    const apiKey = this.configService.get<string>('weather.apiKey');
    if (!apiKey) {
      this.logger.warn('未配置 WEATHER_API_KEY，跳过天气查询');
      return null;
    }
    const raw = cityInput?.trim();
    if (!raw) return null;
    const city = CITY_MAP[raw] ?? raw;

    try {
      const url = `${this.apiUrl}?key=${encodeURIComponent(apiKey)}&city=${encodeURIComponent(city)}`;
      const res = await fetch(url, { method: 'GET' });
      if (!res.ok) {
        this.logger.error(`天气请求失败: ${res.status}`);
        return null;
      }
      const json = (await res.json()) as WhytaWeatherRes;
      // 兼容 data / result 外层包裹，也兼容字段直接在顶层
      const d = this.unwrap(json);
      const rawDesc = this.extractDesc(d?.weatherDesc);
      if (!d || !d.temp_C || !rawDesc) {
        this.logger.warn(`天气接口未返回有效数据: ${json.message ?? json.msg ?? JSON.stringify(json).slice(0, 200)}`);
        return null;
      }
      // 接口实际返回英文描述（大小写不统一，如 "Partly Cloudy "），映射为中文；没收录的原样保留
      const descCn = WEATHER_DESC[rawDesc] ?? WEATHER_DESC[this.toTitleCase(rawDesc)] ?? rawDesc;
      const info = this.normalize(d, descCn);
      // 城市以用户请求的中文名为准（接口回显常是英文拼音，前端联动选择/回显都要中文）
      info.city = raw;
      return info;
    } catch (err) {
      this.logger.error(`天气查询失败: ${(err as Error).message}`);
      return null;
    }
  }

  /**
   * 逆地理编码：浏览器拿到的 WGS84 经纬度 → 国内城市中文名。
   * 用百度 reverse_geocoding，coordtype=wgs84ll 让服务端做 WGS84→BD09 转换，省掉本地坐标换算。
   * @returns 去掉"市/地区"后缀的城市名（如"广州"）；未配 ak/海外/失败返回 null
   */
  async reverseGeocode(latInput: number, lngInput: number): Promise<string | null> {
    const ak = this.configService.get<string>('map.baiduAk');
    if (!ak) {
      this.logger.warn('未配置 BAIDU_MAP_AK，跳过逆地理编码');
      return null;
    }
    const lat = Number(latInput);
    const lng = Number(lngInput);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 3 || lat > 54 || lng < 73 || lng > 136) {
      // 经纬度非法或明显不在中国范围（含海外），直接不支持
      return null;
    }

    try {
      const url = `https://api.map.baidu.com/reverse_geocoding/v3/?ak=${encodeURIComponent(ak)}`
        + `&output=json&coordtype=wgs84ll&location=${lat},${lng}`;
      const res = await fetch(url, { method: 'GET' });
      const json = (await res.json()) as BaiduRegeoRes;
      if (json.status !== 0 || !json.result) {
        this.logger.warn(`百度逆地理失败 status=${json.status} msg=${json.message ?? ''}`);
        return null;
      }
      const comp = json.result.addressComponent;
      if (!comp || comp.country !== '中国') return null;
      // 直辖市/个别省直辖单位 city 可能为空，回退取 province
      const rawCity = (typeof comp.city === 'string' && comp.city) || comp.province || '';
      return this.normalizeCityName(rawCity);
    } catch (err) {
      this.logger.error(`逆地理编码失败: ${(err as Error).message}`);
      return null;
    }
  }

  /** "广州市"→"广州"、"喀什地区"→"喀什"；自治州/盟保留原名（天气接口大概率不支持，原样透传） */
  private normalizeCityName(raw: string): string {
    return raw.trim().replace(/(市|地区)$/u, '');
  }

  /** 剥离常见外层包裹，拿到含天气字段的对象 */
  private unwrap(json: WhytaWeatherRes): WhytaWeatherRes | null {
    if (json?.temp_C && this.extractDesc(json.weatherDesc)) return json;
    if (json?.data?.temp_C && this.extractDesc(json.data.weatherDesc)) return json.data;
    if (json?.result?.temp_C && this.extractDesc(json.result.weatherDesc)) return json.result;
    return null;
  }

  /** 把任意大小写的描述归一为首字母大写（映射表键的格式，如 Partly cloudy） */
  private toTitleCase(s: string): string {
    return s.length ? s[0].toUpperCase() + s.slice(1).toLowerCase() : s;
  }

  /** weatherDesc 官方是 [{value}] 数组，也兼容直接字符串；取第一条有效描述 */
  private extractDesc(raw: WhytaWeatherRes['weatherDesc']): string {
    if (Array.isArray(raw)) return raw[0]?.value?.trim() ?? '';
    return raw?.trim() ?? '';
  }

  /** 原始字段 → 统一结构 + 展示摘要 */
  private normalize(d: WhytaWeatherRes, weatherDesc: string): WeatherInfo {
    const city = d.city ?? '';
    const tempC = d.temp_C ?? '';
    const feelsLikeC = d.FeelsLikeC ?? tempC;
    const humidity = d.humidity ?? '';
    const dirCn = d.winddir16Point ? (WIND_DIR[d.winddir16Point] ?? d.winddir16Point) : '';
    const windText = d.windspeedKmph ? `${dirCn} ${d.windspeedKmph}km/h` : dirCn;

    const parts = [
      weatherDesc,
      tempC ? `${tempC}℃${feelsLikeC && feelsLikeC !== tempC ? `（体感${feelsLikeC}℃）` : ''}` : '',
      humidity ? `湿度${humidity}%` : '',
      windText,
    ].filter(Boolean);

    return { city, weatherDesc, tempC, feelsLikeC, humidity, windText, summary: parts.join(' · ') };
  }
}
