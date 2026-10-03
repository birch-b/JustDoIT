// src/config/configuration.ts
export default () => ({
  port: parseInt(process.env.PORT!, 10) || 3000,
  database: {
    host: process.env.MYSQL_HOST,
    port: parseInt(process.env.MYSQL_PORT!,10),
    username: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN
  },
  llm:{
    baseUrl: process.env.LLM_BASE_URL,
    apiKey: process.env.LLM_API_KEY,
    model: process.env.LLM_MODEL
  },
  tarot: {
    apiKey: process.env.TAROT_API_KEY
  },
  weather: {
    apiKey: process.env.WEATHER_API_KEY
  },
  // 百度地图逆地理编码（经纬度→城市）
  map: {
    baiduAk: process.env.BAIDU_MAP_AK
  },
  // mxnzp 全国城市列表
  city: {
    appId: process.env.MXNZP_APP_ID,
    appSecret: process.env.MXNZP_APP_SECRET
  },
  // QQ邮箱SMTP，用于发送验证码邮件
  mail: {
    user: process.env.QQ_MAIL_USER,
    authCode: process.env.QQ_MAIL_AUTH_CODE
  }
})
