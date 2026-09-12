// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserModule } from './user/user.module';
import { JwtStrategy } from './common/strategies/jwt.strategy';
import { AgentModule } from './agent/agent.module';
// 加载自定义配置文件
import configuration from './config/configuration';

@Module({
  imports: [
    // 全局配置模块，读取项目配置
    ConfigModule.forRoot({
      isGlobal: true, // 全局可用，不用每个模块都导入
      load: [configuration] // 载入自定义配置函数
    }),

    // 异步配置TypeORM MySQL数据库连接
    TypeOrmModule.forRootAsync({
      // 工厂函数，从ConfigService拿配置参数
      useFactory: (configService: ConfigService) => ({
        type: 'mysql',                    // 数据库类型
        host: configService.get('database.host'),     // 数据库地址
        port: configService.get('database.port'),     // 端口
        username: configService.get('database.username'), //账号
        password: configService.get('database.password'), //密码
        database: configService.get('database.database'), //库名
        entities: [__dirname + '/**/*.entity{.ts,.js}'], //扫描实体类
        synchronize: true, // 开发自动建表；生产务必关闭，用迁移
        autoLoadEntities: true, // 自动加载实体
        charset: 'utf8mb4' // 支持emoji完整utf8
      }),
      inject: [ConfigService] // 注入配置服务
    }),

    UserModule,

    AgentModule
  ],
  providers: [JwtStrategy],
})
export class AppModule {}
