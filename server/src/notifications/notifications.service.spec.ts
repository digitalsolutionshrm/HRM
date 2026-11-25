import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Notification } from './entities/notification.entity';
import { NotificationService } from './notifications.service';
import { NotificationGateway } from './notifications.gateway';
import { Employee } from '../employees/entities/employee.entity';
import { User } from '../users/entities/user.entity';

describe('NotificationService', () => {
  let service: NotificationService;
  const saved = {
    id: 1,
    userId: 3,
    email: 'employee@example.com',
    title: 'Hello',
    message: 'An update',
    type: 'GENERAL',
    isRead: false,
    emailSent: false,
  } as Notification;

  const notificationRepository = {
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => ({ ...saved, ...value })),
    findOne: jest.fn(async (): Promise<Notification | null> => saved),
    count: jest.fn(async () => 1),
  };
  const userRepository = {
    findOne: jest.fn(async () => ({
      id: 3,
      email: 'employee@example.com',
      status: true,
    })),
  };
  const gateway = {
    notifyUser: jest.fn(),
    notifyUnreadCount: jest.fn(),
    notifyRead: jest.fn(),
    notifyDeleted: jest.fn(),
    notifyReadAll: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        {
          provide: getRepositoryToken(Notification),
          useValue: notificationRepository,
        },
        { provide: getRepositoryToken(Employee), useValue: {} },
        { provide: getRepositoryToken(User), useValue: userRepository },
        { provide: NotificationGateway, useValue: gateway },
      ],
    }).compile();
    service = module.get<NotificationService>(NotificationService);
  });

  it('saves a new unread in-app notification and publishes it', async () => {
    const result = await service.createInAppNotification({
      userId: 3,
      title: 'Hello',
      message: 'An update',
    });

    expect(result.isRead).toBe(false);
    expect(result.emailSent).toBe(false);
    expect(notificationRepository.save).toHaveBeenCalled();
    expect(gateway.notifyUser).toHaveBeenCalledWith(
      3,
      expect.objectContaining({ title: 'Hello' }),
    );
  });

  it('hides another user’s notification as not found', async () => {
    notificationRepository.findOne.mockResolvedValueOnce(null);

    await expect(service.findOneForUser(1, 99)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('records the read timestamp for the owner', async () => {
    await service.markAsReadForUser(1, 3);

    expect(notificationRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ isRead: true, readAt: expect.any(Date) }),
    );
    expect(gateway.notifyRead).toHaveBeenCalledWith(
      3,
      expect.objectContaining({ isRead: true }),
    );
  });
});
