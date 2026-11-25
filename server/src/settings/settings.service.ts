import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';

import { WorkSettings } from './entities/work-settings.entity';
import { Holiday } from './entities/holiday.entity';
import {
  CreateHolidayDto,
  UpdateHolidayDto,
  UpdateWorkSettingsDto,
} from './dto/settings.dto';

/** Accepts "HH:mm" or "HH:mm:ss" and returns a stored "HH:mm:ss" value. */
function normalizeTime(value?: string | null): string | undefined {
  if (!value) return undefined;
  const parts = value.split(':');
  const hours = String(Number(parts[0] ?? 0)).padStart(2, '0');
  const minutes = String(Number(parts[1] ?? 0)).padStart(2, '0');
  const seconds = String(Number(parts[2] ?? 0)).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(WorkSettings)
    private readonly workSettingsRepository: Repository<WorkSettings>,

    @InjectRepository(Holiday)
    private readonly holidaysRepository: Repository<Holiday>,
  ) {}

  /** Returns the single settings row, creating it with defaults when missing. */
  async getWorkSettings(): Promise<WorkSettings> {
    const existing = await this.workSettingsRepository.findOne({
      where: {},
      order: { id: 'ASC' },
    });
    if (existing) return existing;

    return this.workSettingsRepository.save(
      this.workSettingsRepository.create({
        officeStartTime: '09:30:00',
        officeEndTime: '18:30:00',
        graceMinutes: 30,
        standardWorkHours: 8,
        paidLeavesPerMonth: 2,
        weeklyOffDays: [0],
      }),
    );
  }

  async updateWorkSettings(dto: UpdateWorkSettingsDto): Promise<WorkSettings> {
    const settings = await this.getWorkSettings();

    if (dto.officeStartTime !== undefined) {
      settings.officeStartTime = normalizeTime(dto.officeStartTime)!;
    }
    if (dto.officeEndTime !== undefined) {
      settings.officeEndTime = normalizeTime(dto.officeEndTime)!;
    }
    if (dto.graceMinutes !== undefined) settings.graceMinutes = dto.graceMinutes;
    if (dto.standardWorkHours !== undefined) {
      settings.standardWorkHours = dto.standardWorkHours;
    }
    if (dto.paidLeavesPerMonth !== undefined) {
      settings.paidLeavesPerMonth = dto.paidLeavesPerMonth;
    }
    if (dto.weeklyOffDays !== undefined) {
      settings.weeklyOffDays = Array.from(new Set(dto.weeklyOffDays)).sort();
    }

    return this.workSettingsRepository.save(settings);
  }

  // ---------------- Holidays ----------------

  async listHolidays(year?: number): Promise<Holiday[]> {
    if (year && Number.isInteger(year)) {
      return this.holidaysRepository.find({
        where: {
          date: Between(`${year}-01-01`, `${year}-12-31`),
        },
        order: { date: 'ASC' },
      });
    }
    return this.holidaysRepository.find({ order: { date: 'ASC' } });
  }

  /** date -> holiday name for every holiday in the inclusive range. */
  async getHolidayMap(startDate: string, endDate: string): Promise<Map<string, string>> {
    const holidays = await this.holidaysRepository.find({
      where: { date: Between(startDate, endDate) },
    });
    return new Map(holidays.map((holiday) => [String(holiday.date).slice(0, 10), holiday.name]));
  }

  async createHoliday(dto: CreateHolidayDto): Promise<Holiday> {
    const date = dto.date.slice(0, 10);
    const existing = await this.holidaysRepository.findOne({ where: { date } });
    if (existing) {
      throw new ConflictException(`A holiday already exists on ${date}`);
    }
    return this.holidaysRepository.save(
      this.holidaysRepository.create({
        name: dto.name.trim(),
        date,
        description: dto.description?.trim() || null,
      }),
    );
  }

  async updateHoliday(id: number, dto: UpdateHolidayDto): Promise<Holiday> {
    const holiday = await this.holidaysRepository.findOne({ where: { id } });
    if (!holiday) throw new NotFoundException(`Holiday with ID ${id} not found`);

    if (dto.date !== undefined) {
      const date = dto.date.slice(0, 10);
      if (date !== holiday.date) {
        const duplicate = await this.holidaysRepository.findOne({ where: { date } });
        if (duplicate) {
          throw new ConflictException(`A holiday already exists on ${date}`);
        }
      }
      holiday.date = date;
    }
    if (dto.name !== undefined) holiday.name = dto.name.trim();
    if (dto.description !== undefined) {
      holiday.description = dto.description.trim() || null;
    }

    return this.holidaysRepository.save(holiday);
  }

  async removeHoliday(id: number) {
    const holiday = await this.holidaysRepository.findOne({ where: { id } });
    if (!holiday) throw new NotFoundException(`Holiday with ID ${id} not found`);
    await this.holidaysRepository.remove(holiday);
    return { message: 'Holiday deleted successfully' };
  }
}
