import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import {
  OnGatewayConnection,
  WebSocketServer,
  WebSocketGateway,
} from '@nestjs/websockets';
import { IsNull, Repository } from 'typeorm';
import { Server, Socket } from 'socket.io';
import { AuthSession } from '../auth/entities/auth-session.entity';
import { User } from '../users/entities/user.entity';
import { Notification } from './entities/notification.entity';

@WebSocketGateway({
  cors: {
    origin: [
      'http://localhost:3001',
      'https://hrm-frontend-5nsq881yf-digital-solution4.vercel.app',
    ],
    credentials: true,
  },
})
@Injectable()
export class NotificationGateway implements OnGatewayConnection {
  @WebSocketServer()
  private io!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectRepository(AuthSession)
    private readonly sessionRepository: Repository<AuthSession>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const rawToken =
        client.handshake.auth?.token ?? client.handshake.headers.authorization;
      const token =
        typeof rawToken === 'string' && rawToken.startsWith('Bearer ')
          ? rawToken.slice(7)
          : rawToken;
      if (typeof token !== 'string' || !token) throw new Error('Missing token');

      const payload = await this.jwtService.verifyAsync<{
        sub: number;
        sessionId: string;
      }>(token, {
        secret: this.configService.getOrThrow<string>('JWT_SECRET'),
      });
      if (!payload.sub || !payload.sessionId) throw new Error('Invalid token');

      const [session, user] = await Promise.all([
        this.sessionRepository.findOne({
          where: {
            sessionId: payload.sessionId,
            userId: payload.sub,
            revokedAt: IsNull(),
          },
        }),
        this.userRepository.findOne({
          where: { id: payload.sub, status: true },
        }),
      ]);
      if (!session || session.expiresAt <= new Date() || !user)
        throw new Error('Session expired');

      client.data.userId = user.id;
      await client.join(this.userRoom(user.id));
      const [history, unreadCount] = await Promise.all([
        this.notificationRepository.find({
          where: { userId: user.id },
          order: { createdAt: 'DESC' },
          take: 50,
        }),
        this.notificationRepository.count({
          where: { userId: user.id, isRead: false },
        }),
      ]);
      client.emit('notification:history', history);
      client.emit('notification:unread-count', { count: unreadCount });
    } catch {
      client.disconnect(true);
    }
  }

  notifyUser(userId: number, notification: Notification): void {
    this.serverEmit(userId, 'notification:new', notification);
  }

  notifyRead(userId: number, notification: Notification): void {
    this.serverEmit(userId, 'notification:read', notification);
  }

  notifyDeleted(userId: number, notificationId: number): void {
    this.serverEmit(userId, 'notification:deleted', { id: notificationId });
  }

  notifyReadAll(userId: number): void {
    this.serverEmit(userId, 'notification:read-all', {});
  }

  notifyUnreadCount(userId: number, count: number): void {
    this.serverEmit(userId, 'notification:unread-count', { count });
  }

  private serverEmit(userId: number, event: string, data: unknown): void {
    this.io?.to(this.userRoom(userId)).emit(event, data);
  }

  private userRoom(userId: number): string {
    return `user:${userId}`;
  }
}
