import { Controller, Get, NotFoundException, Param, ParseIntPipe, Res } from '@nestjs/common';
import type { Response } from 'express';
import { EmployeesService } from './employees.service';

@Controller('media')
export class ProfileMediaController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get('profile-images/:employeeId/:imageToken')
  async getProfileImage(
    @Param('employeeId', ParseIntPipe) employeeId: number,
    @Param('imageToken') imageToken: string,
    @Res() response: Response,
  ) {
    const image = await this.employeesService.getProfileImageData(employeeId, imageToken);
    if (!image.mimeType.startsWith('image/')) {
      throw new NotFoundException('Profile image not found');
    }

    response.setHeader('Content-Type', image.mimeType);
    response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    response.send(image.buffer);
  }
}
