import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification, NotificationType } from './entities/notification.entity';
import { Employee } from '../employees/entities/employee.entity';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../auth/enums/user-role.enum';
import { NotificationGateway } from './notifications.gateway';

export interface NotificationOptions {
  userId: number;
  email?: string;
  title: string;
  message: string;
  type?: NotificationType;
  relatedEntityType?: string;
  relatedEntityId?: string;
  url?: string;
  dedupeKey?: string;
}

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    @InjectRepository(Employee)
    private readonly employeeRepository: Repository<Employee>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly notificationGateway: NotificationGateway,
  ) {}

  /** Send one deduplicated birthday notice per employee and recipient per day. */
  async notifyBirthdaysToday(): Promise<{ birthdays: number; anniversaries: number; notifications: number }> {
    const todayParts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    const datePart = (type: string) => todayParts.find((part) => part.type === type)?.value ?? '';
    const today = `${datePart('year')}-${datePart('month')}-${datePart('day')}`;
    const monthDay = today.slice(5);

    const employees = await this.employeeRepository.find({
      where: { status: true },
      relations: { user: true, personalDetails: true, department: true },
    });
    const birthdays = employees.filter((employee) => {
      const birthDate = employee.personalDetails?.dateOfBirth;
      return Boolean(employee.user?.status && birthDate && String(birthDate).slice(5, 10) === monthDay);
    });
    const anniversaries = employees.filter((employee) => {
      const joiningDate = employee.joiningDate;
      if (!employee.user?.status || !joiningDate) return false;
      const joined = String(joiningDate).slice(0, 10);
      const joinedYear = Number(joined.slice(0, 4));
      return joinedYear < Number(today.slice(0, 4)) && joined.slice(5, 10) === monthDay;
    });
    if (birthdays.length === 0 && anniversaries.length === 0)
      return { birthdays: 0, anniversaries: 0, notifications: 0 };

    const recipients = await this.userRepository.find({ where: { status: true } });
    let sent = 0;
    const notifyGroup = async (group: typeof birthdays, kind: 'birthday' | 'work_anniversary') => {
      for (const employee of group) {
        const name = `${employee.firstName} ${employee.lastName}`.trim();
        const years = employee.joiningDate
          ? Number(today.slice(0, 4)) - Number(String(employee.joiningDate).slice(0, 4))
          : 0;
        await Promise.all(recipients.map(async (recipient) => {
          const isCelebratedUser = recipient.id === employee.user.id;
          try {
            await this.createInAppNotification({
              userId: recipient.id,
              title: kind === 'birthday'
                ? isCelebratedUser ? 'Happy Birthday!' : `Birthday today: ${name}`
                : isCelebratedUser ? 'Happy Work Anniversary!' : `Work anniversary today: ${name}`,
              message: kind === 'birthday'
                ? isCelebratedUser
                  ? `Happy Birthday, ${name}! Wishing you a wonderful year ahead.`
                  : `Today is ${name}'s birthday. Department: ${employee.department?.name ?? 'Unassigned'}.`
                : isCelebratedUser
                  ? `Congratulations, ${name}! You have completed ${years} ${years === 1 ? 'year' : 'years'} with the company.`
                  : `Today marks ${name}'s ${years}-year work anniversary. Department: ${employee.department?.name ?? 'Unassigned'}.`,
              type: NotificationType.EMPLOYEE,
              relatedEntityType: kind === 'birthday'
                ? isCelebratedUser ? 'birthday_greeting' : 'birthday_announcement'
                : isCelebratedUser ? 'work_anniversary_greeting' : 'work_anniversary_announcement',
              relatedEntityId: String(employee.id),
              dedupeKey: `${kind}:${today}:${employee.id}:${recipient.id}`,
            });
            sent += 1;
          } catch {
            // One unavailable recipient must not prevent notices to others.
          }
        }));
      }
    };

    await notifyGroup(birthdays, 'birthday');
    await notifyGroup(anniversaries, 'work_anniversary');
    return { birthdays: birthdays.length, anniversaries: anniversaries.length, notifications: sent };
  }



  async createInAppNotification(
    options: NotificationOptions,
  ): Promise<Notification> {
    const user = await this.userRepository.findOne({
      where: { id: options.userId, status: true },
    });
    if (!user) throw new NotFoundException('Notification recipient not found');

    if (options.dedupeKey) {
      const existing = await this.notificationRepository.findOne({
        where: { userId: user.id, dedupeKey: options.dedupeKey },
      });
      if (existing) return existing;
    }

    const draft = this.notificationRepository.create({
      userId: user.id,
      title: options.title,
      message: options.message,
      type: options.type ?? NotificationType.GENERAL,
      isRead: false,
      emailSent: false,
      relatedEntityType: options.relatedEntityType,
      relatedEntityId: options.relatedEntityId,
      url: options.url,
      dedupeKey: options.dedupeKey,
    });
    let notification: Notification;
    try {
      notification = await this.notificationRepository.save(draft);
    } catch (error) {
      const databaseCode = (error as { driverError?: { code?: string } })
        ?.driverError?.code;
      if (options.dedupeKey && databaseCode === '23505') {
        const existing = await this.notificationRepository.findOne({
          where: { userId: user.id, dedupeKey: options.dedupeKey },
        });
        if (existing) return existing;
      }
      throw error;
    }
    this.notificationGateway.notifyUser(user.id, notification);
    const { count } = await this.getUnreadCount(user.id);
    this.notificationGateway.notifyUnreadCount(user.id, count);
    return notification;
  }

  // Kept for existing workflow callers. In-app delivery never waits for email.
  async sendEmailAndInAppNotification(
    options: NotificationOptions & { email?: string },
  ): Promise<Notification> {
    const notification = await this.createInAppNotification(options);
    if (
      process.env.NOTIFICATIONS_EMAIL_ENABLED === 'true' &&
      !notification.emailSent
    ) {
      void this.sendOptionalEmail(notification).catch(() => undefined);
    }
    return notification;
  }

  async sendEmailNotification(
    options: NotificationOptions & { email?: string },
  ): Promise<Notification> {
    return this.sendEmailAndInAppNotification(options);
  }

  private async sendOptionalEmail(notification: Notification): Promise<void> {
    const nodemailer = await import('nodemailer');
    const recipient = await this.userRepository.findOne({
      where: { id: notification.userId, status: true },
    });
    if (!recipient)
      throw new Error('Notification recipient is no longer active');
    const transporter = nodemailer.createTransport({
      host: process.env.MAIL_HOST,
      port: Number(process.env.MAIL_PORT) || 587,
      secure: process.env.MAIL_SECURE === 'true',
      auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_PASSWORD },
    });
    await transporter.sendMail({
      from: process.env.MAIL_FROM || process.env.MAIL_USER,
      to: recipient.email,
      subject: notification.title,
      text: notification.message,
    });
    notification.emailSent = true;
    await this.notificationRepository.save(notification);
  }

  async notifyDepartmentApprovers(
    employeeUserId: number,
    title: string,
    message: string,
    type: NotificationType,
    dedupeKey?: string,
  ): Promise<void> {
    const employee = await this.employeeRepository.findOne({
      where: { user: { id: employeeUserId } },
      relations: {
        department: true,
        manager: { user: true, department: true },
      },
    });
    if (!employee) return;

    const recipients = new Map<number, User>();
    const hrUsers = await this.userRepository.find({
      where: { role: UserRole.HR, status: true },
    });
    hrUsers.forEach((user) => recipients.set(user.id, user));
    const manager = employee.manager;
    if (
      manager?.user?.status &&
      manager.user.role === UserRole.MANAGER &&
      manager.department?.id === employee.department?.id
    ) {
      recipients.set(manager.user.id, manager.user);
    }

    const employeeName = `${employee.firstName} ${employee.lastName}`;
    await Promise.all(
      [...recipients.keys()].map((userId) =>
        this.createInAppNotification({
          userId,
          title,
          message: `${employeeName} ${message}\nDepartment: ${employee.department?.name ?? 'Unassigned'}`,
          type,
          dedupeKey: dedupeKey ? `${dedupeKey}:${userId}` : undefined,
        }),
      ),
    );
  }

  async create(
    options: NotificationOptions & { email?: string },
  ): Promise<Notification> {
    return this.sendEmailAndInAppNotification(options);
  }

  async findByUser(userId: number): Promise<Notification[]> {
    return (await this.listForUser(userId, { page: 1, limit: 20 })).items;
  }

  async listForUser(
    userId: number,
    filters: {
      page?: number;
      limit?: number;
      type?: NotificationType;
      isRead?: boolean;
    },
  ): Promise<{
    items: Notification[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
    const query = this.notificationRepository
      .createQueryBuilder('notification')
      .where('notification.userId = :userId', { userId });
    if (filters.type)
      query.andWhere('notification.type = :type', { type: filters.type });
    if (filters.isRead !== undefined)
      query.andWhere('notification.isRead = :isRead', {
        isRead: filters.isRead,
      });
    const [items, total] = await query
      .orderBy('notification.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    return { items, total, page, limit };
  }

  async getUnreadCount(userId: number): Promise<{ count: number }> {
    const count = await this.notificationRepository.count({
      where: { userId, isRead: false },
    });
    return { count };
  }

  async findOne(id: number): Promise<Notification> {
    const notification = await this.notificationRepository.findOne({
      where: { id },
    });
    if (!notification)
      throw new NotFoundException(`Notification with ID ${id} not found`);
    return notification;
  }

  async findOneForUser(id: number, userId: number): Promise<Notification> {
    const notification = await this.notificationRepository.findOne({
      where: { id, userId },
    });
    if (!notification)
      throw new NotFoundException(`Notification with ID ${id} not found`);
    return notification;
  }

  async markAsReadForUser(id: number, userId: number): Promise<Notification> {
    const notification = await this.findOneForUser(id, userId);
    if (!notification.isRead) {
      notification.isRead = true;
      notification.readAt = new Date();
      await this.notificationRepository.save(notification);
      this.notificationGateway.notifyRead(userId, notification);
      const { count } = await this.getUnreadCount(userId);
      this.notificationGateway.notifyUnreadCount(userId, count);
    }
    return notification;
  }

  async markAsUnreadForUser(id: number, userId: number): Promise<Notification> {
    const notification = await this.findOneForUser(id, userId);
    notification.isRead = false;
    notification.readAt = null;
    const saved = await this.notificationRepository.save(notification);
    this.notificationGateway.notifyRead(userId, saved);
    const { count } = await this.getUnreadCount(userId);
    this.notificationGateway.notifyUnreadCount(userId, count);
    return saved;
  }

  async markAllAsRead(userId: number): Promise<{ updated: number }> {
    const result = await this.notificationRepository
      .createQueryBuilder()
      .update(Notification)
      .set({ isRead: true, readAt: () => 'CURRENT_TIMESTAMP' })
      .where('userId = :userId AND isRead = false', { userId })
      .execute();
    this.notificationGateway.notifyReadAll(userId);
    this.notificationGateway.notifyUnreadCount(userId, 0);
    return { updated: result.affected ?? 0 };
  }

  async removeForUser(
    id: number,
    userId: number,
  ): Promise<{ message: string }> {
    const notification = await this.findOneForUser(id, userId);
    await this.notificationRepository.delete({ id, userId });
    this.notificationGateway.notifyDeleted(userId, id);
    if (!notification.isRead) {
      const { count } = await this.getUnreadCount(userId);
      this.notificationGateway.notifyUnreadCount(userId, count);
    }
    return { message: 'Notification deleted successfully' };
  }

  async removeReadForUser(userId: number): Promise<{ deleted: number }> {
    const notifications = await this.notificationRepository.find({
      where: { userId, isRead: true },
    });
    const result = await this.notificationRepository.delete({
      userId,
      isRead: true,
    });
    notifications.forEach((notification) =>
      this.notificationGateway.notifyDeleted(userId, notification.id),
    );
    return { deleted: result.affected ?? 0 };
  }

  async createAnnouncement(options: {
    title: string;
    message: string;
    roles?: UserRole[];
    departmentId?: number;
    userIds?: number[];
    actorId: number;
    actorRole: UserRole;
  }): Promise<{ created: number }> {
    const query = this.userRepository
      .createQueryBuilder('user')
      .where('user.status = true');
    if (options.actorRole === UserRole.MANAGER) {
      const manager = await this.employeeRepository
        .createQueryBuilder('manager')
        .innerJoin('manager.user', 'managerUser')
        .where('managerUser.id = :actorId', { actorId: options.actorId })
        .select(['manager.id'])
        .getOne();
      if (!manager) {
        throw new ForbiddenException('Only managers with an employee profile can post team announcements');
      }
      query.innerJoin(
        Employee,
        'teamMember',
        'teamMember.user_id = user.id AND teamMember.manager_id = :managerId AND teamMember.status = true',
        { managerId: manager.id },
      );
    } else if (options.actorRole !== UserRole.ADMIN && options.actorRole !== UserRole.HR) {
      throw new ForbiddenException('You are not allowed to post announcements');
    } else {
      if (options.userIds?.length)
        query.andWhere('user.id IN (:...userIds)', { userIds: options.userIds });
      if (options.roles?.length)
        query.andWhere('user.role IN (:...roles)', { roles: options.roles });
    }
    if (options.actorRole !== UserRole.MANAGER && options.departmentId)
      query.innerJoin(
        Employee,
        'employee',
        'employee.user_id = user.id AND employee.department_id = :departmentId',
        { departmentId: options.departmentId },
      );
    const users = await query.select(['user.id']).getMany();
    const recipients = users.filter((user) => user.id !== options.actorId);
    const notifications = recipients.map((user) =>
      this.notificationRepository.create({
        userId: user.id,
        title: options.title,
        message: options.message,
        type: NotificationType.GENERAL,
        relatedEntityType: 'ANNOUNCEMENT',
        relatedEntityId: options.actorRole,
        announcementAuthorRole: options.actorRole,
        isRead: false,
        emailSent: false,
      }),
    );
    if (notifications.length) {
      const saved = await this.notificationRepository.save(notifications);
      const unreadCounts = await this.notificationRepository
        .createQueryBuilder('notification')
        .select('notification.userId', 'userId')
        .addSelect('COUNT(*)', 'count')
        .where('notification.userId IN (:...userIds)', {
          userIds: saved.map((notification) => notification.userId),
        })
        .andWhere('notification.isRead = false')
        .groupBy('notification.userId')
        .getRawMany<{ userId: string; count: string }>();
      const countByUser = new Map(
        unreadCounts.map((row) => [Number(row.userId), Number(row.count)]),
      );
      for (const notification of saved) {
        this.notificationGateway.notifyUser(notification.userId, notification);
        this.notificationGateway.notifyUnreadCount(
          notification.userId,
          countByUser.get(notification.userId) ?? 0,
        );
      }
    }
    return { created: notifications.length };
  }

  // Compatibility methods retain ownership checks in the user-facing paths.
  async update(
    id: number,
    update: { isRead?: boolean },
  ): Promise<Notification> {
    const notification = await this.findOne(id);
    if (update.isRead !== undefined) {
      notification.isRead = update.isRead;
      notification.readAt = update.isRead ? new Date() : null;
    }
    return this.notificationRepository.save(notification);
  }
  async markAsRead(id: number): Promise<Notification> {
    return this.update(id, { isRead: true });
  }
  async markAsUnread(id: number): Promise<Notification> {
    return this.update(id, { isRead: false });
  }
  async remove(id: number): Promise<{ message: string }> {
    await this.notificationRepository.delete({ id });
    return { message: 'Notification deleted successfully' };
  }
  async resendEmail(id: number): Promise<Notification> {
    const notification = await this.findOne(id);
    await this.sendOptionalEmail(notification);
    return notification;
  }
}
