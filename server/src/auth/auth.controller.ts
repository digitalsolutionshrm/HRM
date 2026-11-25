import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';

import type { Request, Response } from 'express';

import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import type { AuthenticatedUser } from './interfaces/authenticated-user.interface';
import { UserRole } from './enums/user-role.enum';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
  ) {}

  @Post('login')
  async login(
    @Body() loginDto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(
      loginDto,
      req,
    );

    this.setRefreshTokenCookie(
      res,
      result.refreshToken,
    );

    return {
      message: result.message,
      accessToken: result.accessToken,
      user: result.user,
    };
  }

  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken =
      req.cookies?.refreshToken;

    const result =
      await this.authService.refreshTokens(
        refreshToken,
        req,
      );

    this.setRefreshTokenCookie(
      res,
      result.refreshToken,
    );

    return {
      message: result.message,
      accessToken: result.accessToken,
    };
  }

  @Post('logout')
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken =
      req.cookies?.refreshToken;

    await this.authService.logout(
      refreshToken,
    );

    this.clearRefreshTokenCookie(res);

    return {
      message: 'Logout successful',
    };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@Req() req: any) {
    return this.authService.getMe(req.user.id);
  }

  @Patch('change-password')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  changePassword(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(currentUser.id, dto);
  }

  private setRefreshTokenCookie(
    res: Response,
    refreshToken: string,
  ): void {
    const isProduction =
      process.env.NODE_ENV === 'production';

    res.cookie(
      'refreshToken',
      refreshToken,
      {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction
          ? 'none'
          : 'lax',
        path: '/api/auth',
        maxAge:
          7 *
          24 *
          60 *
          60 *
          1000,
      },
    );
  }

  private clearRefreshTokenCookie(
    res: Response,
  ): void {
    const isProduction =
      process.env.NODE_ENV === 'production';

    res.clearCookie(
      'refreshToken',
      {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction
          ? 'none'
          : 'lax',
        path: '/api/auth',
      },
    );
  }
}