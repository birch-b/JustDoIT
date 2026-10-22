// 后台管理模块
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { User } from '../user/entities/user.entity';
import { Feedback } from '../feedback/entities/feedback.entity';
import { Announcement } from './entities/announcement.entity';
import { Visit } from './entities/visit.entity';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { PublicController } from './public.controller';
import { AdminGuard } from './guards/admin.guard';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' }), TypeOrmModule.forFeature([User, Feedback, Announcement, Visit])],
  controllers: [AdminController, PublicController],
  providers: [AdminService, AdminGuard],
})
export class AdminModule {}
