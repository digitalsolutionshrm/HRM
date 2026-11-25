import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
  Body,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { UserRole } from '../auth/enums/user-role.enum';
import { NotificationType } from './entities/notification.entity';
import { CreateAnnouncementDto } from './dto/create-notification.dto';
import { NotificationService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get('unread-count')
  getUnreadCount(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationService.getUnreadCount(user.id);
  }

  @Get('me')
  findMine(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.notificationService
      .listForUser(user.id, {
        page: Math.max(1, Number(page) || 1),
        limit: Math.min(100, Math.max(1, Number(limit) || 20)),
      })
      .then((result) => result.items);
  }

  @Post('birthdays/check')
  notifyBirthdaysToday() {
    return this.notificationService.notifyBirthdaysToday();
  }

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('type') type?: NotificationType,
    @Query('isRead') isRead?: string,
  ) {
    if (type && !Object.values(NotificationType).includes(type)) {
      throw new BadRequestException('Invalid notification type');
    }
    if (isRead !== undefined && !['true', 'false'].includes(isRead)) {
      throw new BadRequestException('isRead must be true or false');
    }
    return this.notificationService.listForUser(user.id, {
      page: Math.max(1, Number(page) || 1),
      limit: Math.min(100, Math.max(1, Number(limit) || 20)),
      type,
      isRead: isRead === undefined ? undefined : isRead === 'true',
    });
  }

  @Post('announcements')
  @Roles(UserRole.ADMIN, UserRole.HR, UserRole.MANAGER)
  createAnnouncement(
    @Body() dto: CreateAnnouncementDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.notificationService.createAnnouncement({
      ...dto,
      actorId: user.id,
      actorRole: user.role,
    });
  }

  @Patch('read-all')
  markAllAsRead(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationService.markAllAsRead(user.id);
  }

  @Delete('read')
  removeRead(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationService.removeReadForUser(user.id);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.notificationService.findOneForUser(id, user.id);
  }

  @Patch(':id/read')
  markAsRead(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.notificationService.markAsReadForUser(id, user.id);
  }

  @Patch(':id/unread')
  markAsUnread(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.notificationService.markAsUnreadForUser(id, user.id);
  }

  @Delete(':id')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.notificationService.removeForUser(id, user.id);
  }
}
