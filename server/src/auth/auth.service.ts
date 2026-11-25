import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import {
  IsNull,
  Repository,
} from 'typeorm';

import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

import * as bcrypt from 'bcrypt';
import { StringValue } from 'ms';

import { randomUUID } from 'crypto';

import type { Request } from 'express';

import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

import { AuthSession } from './entities/auth-session.entity';

import { NotificationService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/entities/notification.entity';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,

    private readonly jwtService: JwtService,

    private readonly configService: ConfigService,

    @InjectRepository(AuthSession)
    private readonly authSessionRepository: Repository<AuthSession>,

    private readonly notificationService: NotificationService,
  ) {}

  // ==========================================
  // LOGIN
  // POST /api/auth/login
  // ==========================================

  async login(
    loginDto: LoginDto,
    req: Request,
  ) {
    const user = await this.usersService.findByEmail(
      loginDto.email,
    );

    if (!user) {
      throw new UnauthorizedException(
        'Invalid email or password',
      );
    }

    const passwordMatch = await bcrypt.compare(
      loginDto.password,
      user.password,
    );

    if (!passwordMatch) {
      throw new UnauthorizedException(
        'Invalid email or password',
      );
    }

    if (!user.status) {
      throw new UnauthorizedException(
        'User account is inactive',
      );
    }

    // ------------------------------------------
    // Email verification check
    // ------------------------------------------

    // if (!user.emailVerified) {
    //   throw new UnauthorizedException({
    //     code: 'EMAIL_NOT_VERIFIED',
    //     message:
    //       'Please verify your email before logging in.',
    //   });
    // }

    // ------------------------------------------
    // Create unique session ID
    // ------------------------------------------

    const sessionId = randomUUID();

    // ------------------------------------------
    // JWT payload
    // ------------------------------------------

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      sessionId,
    };

    // ------------------------------------------
    // Access token
    // ------------------------------------------

    const accessToken =
      await this.jwtService.signAsync(payload);

    // ------------------------------------------
    // Refresh token
    // ------------------------------------------

    const refreshToken =
      await this.jwtService.signAsync(
        {
          ...payload,
          jti: sessionId,
        },
        {
          secret:
            this.configService.getOrThrow<string>(
              'JWT_REFRESH_SECRET',
            ),

          expiresIn:
            (this.configService.get<string>(
              'JWT_REFRESH_EXPIRES_IN',
            ) as StringValue) || '7d',
        },
      );

    // ------------------------------------------
    // Hash refresh token
    // ------------------------------------------

    const tokenHash =
      await bcrypt.hash(
        refreshToken,
        12,
      );

    // ------------------------------------------
    // Refresh expiry
    // ------------------------------------------

    const refreshExpiresIn =
      this.configService.get<string>(
        'JWT_REFRESH_EXPIRES_IN',
      ) || '7d';

    const expiresAt =
      this.calculateExpiryDate(
        refreshExpiresIn,
      );

    // ------------------------------------------
    // Save authentication session
    // ------------------------------------------

    const session =
      this.authSessionRepository.create({
        sessionId,

        userId: user.id,

        tokenHash,

        expiresAt,

        revokedAt: null,

        userAgent:
          req.headers['user-agent'] ?? null,

        ipAddress:
          req.ip ?? null,
      });

    await this.authSessionRepository.save(
      session,
    );

    // ------------------------------------------
    // Return login result
    // ------------------------------------------

    return {
      message: 'Login successful',

      accessToken,

      refreshToken,

      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
      },
    };
  }

  // ==========================================
  // REFRESH TOKEN
  // POST /api/auth/refresh
  // ==========================================

  async refreshTokens(
    refreshToken: string | undefined,
    req: Request,
  ) {
    if (!refreshToken) {
      throw new UnauthorizedException(
        'Refresh token is required',
      );
    }

    try {
      const payload =
        await this.jwtService.verifyAsync<{
          sub: number;
          email: string;
          role: string;
          jti: string;
        }>(
          refreshToken,
          {
            secret:
              this.configService.getOrThrow<string>(
                'JWT_REFRESH_SECRET',
              ),
          },
        );

      if (!payload.jti) {
        throw new UnauthorizedException(
          'Invalid refresh token',
        );
      }

      const session =
        await this.authSessionRepository.findOne({
          where: {
            sessionId: payload.jti,
            userId: payload.sub,
            revokedAt: IsNull(),
          },
        });

      if (!session) {
        throw new UnauthorizedException(
          'Session expired or revoked',
        );
      }

      if (
        session.expiresAt.getTime() <=
        Date.now()
      ) {
        session.revokedAt = new Date();

        await this.authSessionRepository.save(
          session,
        );

        throw new UnauthorizedException(
          'Refresh token expired',
        );
      }

      const tokenMatches =
        await bcrypt.compare(
          refreshToken,
          session.tokenHash,
        );

      if (!tokenMatches) {
        session.revokedAt = new Date();

        await this.authSessionRepository.save(
          session,
        );

        throw new UnauthorizedException(
          'Invalid refresh token',
        );
      }

      const user =
        await this.usersService.findOne(
          payload.sub,
        );

      if (!user) {
        session.revokedAt = new Date();

        await this.authSessionRepository.save(
          session,
        );

        throw new UnauthorizedException(
          'User not found',
        );
      }

      if (!user.status) {
        session.revokedAt = new Date();

        await this.authSessionRepository.save(
          session,
        );

        throw new UnauthorizedException(
          'User account is inactive',
        );
      }

      if (!user.emailVerified) {
        session.revokedAt = new Date();

        await this.authSessionRepository.save(
          session,
        );

        // throw new UnauthorizedException({
        //   code: 'EMAIL_NOT_VERIFIED',
        //   message:
        //     'Please verify your email before continuing.',
        // });
      }

      // ----------------------------------------
      // Revoke old session
      // ----------------------------------------

      session.revokedAt = new Date();

      await this.authSessionRepository.save(
        session,
      );

      // ----------------------------------------
      // Create new session
      // ----------------------------------------

      const newSessionId = randomUUID();

      const newPayload = {
        sub: user.id,
        email: user.email,
        role: user.role,
      };

      const accessToken =
        await this.jwtService.signAsync(
          newPayload,
        );

      const newRefreshToken =
        await this.jwtService.signAsync(
          {
            ...newPayload,
            jti: newSessionId,
          },
          {
            secret:
              this.configService.getOrThrow<string>(
                'JWT_REFRESH_SECRET',
              ),

            expiresIn:
              (this.configService.get<string>(
                'JWT_REFRESH_EXPIRES_IN',
              ) as StringValue) || '7d',
          },
        );

      const newTokenHash =
        await bcrypt.hash(
          newRefreshToken,
          12,
        );

      const refreshExpiresIn =
        this.configService.get<string>(
          'JWT_REFRESH_EXPIRES_IN',
        ) || '7d';

      const newExpiresAt =
        this.calculateExpiryDate(
          refreshExpiresIn,
        );

      const newSession =
        this.authSessionRepository.create({
          sessionId: newSessionId,

          userId: user.id,

          tokenHash: newTokenHash,

          expiresAt: newExpiresAt,

          revokedAt: null,

          userAgent:
            req.headers['user-agent'] ?? null,

          ipAddress:
            req.ip ?? null,
        });

      await this.authSessionRepository.save(
        newSession,
      );

      return {
        message:
          'Token refreshed successfully',

        accessToken,

        refreshToken: newRefreshToken,
      };
    } catch (error) {
      if (
        error instanceof UnauthorizedException
      ) {
        throw error;
      }

      throw new UnauthorizedException(
        'Invalid or expired refresh token',
      );
    }
  }

  // ==========================================
  // GET CURRENT USER
  // GET /api/auth/me
  // ==========================================

  async getMe(userId: number) {
    const user =
      await this.usersService.findOne(userId);

    if (!user) {
      throw new UnauthorizedException(
        'User not found',
      );
    }

    if (!user.status) {
      throw new UnauthorizedException(
        'User account is inactive',
      );
    }

    // if (!user.emailVerified) {
    //   throw new UnauthorizedException({
    //     code: 'EMAIL_NOT_VERIFIED',
    //     message:
    //       'Please verify your email before continuing.',
    //   });
    // }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
    };
  }

  async changePassword(userId: number, dto: ChangePasswordDto) {
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException('New password and confirmation do not match.');
    }

    return this.usersService.changeOwnPassword(
      userId,
      dto.currentPassword,
      dto.newPassword,
    );
  }

  // ==========================================
  // LOGOUT
  // ==========================================

  async logout(
    refreshToken?: string,
  ) {
    if (!refreshToken) {
      return {
        message: 'Logout successful',
      };
    }

    try {
      const payload =
        await this.jwtService.verifyAsync<{
          sub: number;
          jti: string;
        }>(
          refreshToken,
          {
            secret:
              this.configService.getOrThrow<string>(
                'JWT_REFRESH_SECRET',
              ),
          },
        );

      if (!payload.jti) {
        return {
          message: 'Logout successful',
        };
      }

      const session =
        await this.authSessionRepository.findOne({
          where: {
            sessionId: payload.jti,
            userId: payload.sub,
            revokedAt: IsNull(),
          },
        });

      if (session) {
        session.revokedAt = new Date();

        await this.authSessionRepository.save(
          session,
        );
      }
    } catch {
      // Logout remains successful even when
      // refresh token is already expired/invalid.
    }

    return {
      message: 'Logout successful',
    };
  }

  // ==========================================
  // CALCULATE REFRESH TOKEN EXPIRY
  // ==========================================

  private calculateExpiryDate(
    duration: string,
  ): Date {
    const match =
      duration.match(
        /^(\d+)([smhd])$/,
      );

    if (!match) {
      return new Date(
        Date.now() +
          7 *
            24 *
            60 *
            60 *
            1000,
      );
    }

    const value = Number(match[1]);

    const unit = match[2];

    const multipliers: Record<
      string,
      number
    > = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };

    return new Date(
      Date.now() +
        value * multipliers[unit],
    );
  }
}