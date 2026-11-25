import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import { Employee } from '../employees/entities/employee.entity';
import { ShiftAssignment } from './entities/shift-assignment.entity';
import { Shift } from './entities/shift.entity';
import { AssignShiftDto, SaveShiftDto } from './dto/shift.dto';

@Injectable()
export class ShiftsService {
  constructor(@InjectRepository(Shift) private readonly shifts: Repository<Shift>, @InjectRepository(ShiftAssignment) private readonly assignments: Repository<ShiftAssignment>, @InjectRepository(Employee) private readonly employees: Repository<Employee>) {}

  list() { return this.shifts.find({ order: { active: 'DESC', name: 'ASC' } }); }
  async create(dto: SaveShiftDto) {
    const code = dto.code.trim().toUpperCase();
    if (dto.startTime.slice(0, 5) === dto.endTime.slice(0, 5)) throw new BadRequestException('Shift start and end times must be different');
    if (await this.shifts.findOne({ where: { code } })) throw new ConflictException('Shift code already exists');
    return this.shifts.save(this.shifts.create({ ...dto, code, name: dto.name.trim() }));
  }
  async update(id: number, dto: Partial<SaveShiftDto>) {
    const shift = await this.shifts.findOne({ where: { id } });
    if (!shift) throw new NotFoundException('Shift not found');
    const startTime = dto.startTime ?? shift.startTime;
    const endTime = dto.endTime ?? shift.endTime;
    if (startTime.slice(0, 5) === endTime.slice(0, 5)) throw new BadRequestException('Shift start and end times must be different');
    if (dto.code) {
      const duplicate = await this.shifts.findOne({ where: { code: dto.code.trim().toUpperCase() } });
      if (duplicate && duplicate.id !== id) throw new ConflictException('Shift code already exists');
    }
    if (dto.active === false) {
      const today = new Date().toISOString().slice(0, 10);
      const linked = await this.assignments.find({ where: { shiftId: id } });
      if (linked.some(item => !item.effectiveTo || item.effectiveTo >= today)) {
        throw new ConflictException('End or reassign active and future employee assignments before deactivating this shift');
      }
    }
    Object.assign(shift, dto, dto.code ? { code: dto.code.trim().toUpperCase() } : {}, dto.name ? { name: dto.name.trim() } : {});
    return this.shifts.save(shift);
  }
  async assign(dto: AssignShiftDto) {
    if (dto.effectiveTo && dto.effectiveTo < dto.effectiveFrom) throw new BadRequestException('effectiveTo must be on or after effectiveFrom');
    const days = [...new Set(dto.weekdays)].sort();
    if (!days.length) throw new BadRequestException('Choose at least one working day');
    const [employee, shift] = await Promise.all([this.employees.findOne({ where: { id: dto.employeeId, status: true } }), this.shifts.findOne({ where: { id: dto.shiftId, active: true } })]);
    if (!employee) throw new NotFoundException('Active employee profile not found');
    if (!shift) throw new NotFoundException('Active shift not found');
    const conflicts = await this.assignments.find({ where: { employeeId: dto.employeeId, effectiveFrom: LessThanOrEqual(dto.effectiveTo ?? '9999-12-31') } });
    const overlaps = conflicts.find(a => (!a.effectiveTo || a.effectiveTo >= dto.effectiveFrom) && a.weekdays.some(day => days.includes(day)));
    if (overlaps) throw new ConflictException('This employee already has a shift assignment for one or more selected weekdays during these dates');
    return this.assignments.save(this.assignments.create({ employee, employeeId: employee.id, shift, shiftId: shift.id, effectiveFrom: dto.effectiveFrom.slice(0,10), effectiveTo: dto.effectiveTo?.slice(0,10) ?? null, weekdays: days, note: dto.note?.trim() || null }));
  }
  listAssignments() { return this.assignments.find({ relations: { employee: { user: true, department: true }, shift: true }, order: { effectiveFrom: 'DESC', id: 'DESC' } }); }
  async endAssignment(id: number, effectiveTo: string) {
    const item = await this.assignments.findOne({ where: { id } });
    if (!item) throw new NotFoundException('Shift assignment not found');
    if (effectiveTo < item.effectiveFrom) throw new BadRequestException('End date cannot be before start date');
    item.effectiveTo = effectiveTo.slice(0,10);
    return this.assignments.save(item);
  }
  async activeForEmployee(userId: number, date: string) {
    const profile = await this.employees.findOne({ where: { user: { id: userId } } });
    if (!profile) throw new NotFoundException('Employee profile not found');
    const weekday = new Date(`${date.slice(0,10)}T12:00:00`).getDay();
    const rows = await this.assignments.find({ where: { employeeId: profile.id }, relations: { shift: true }, order: { effectiveFrom: 'DESC' } });
    return rows.find(row => row.effectiveFrom <= date.slice(0,10) && (!row.effectiveTo || row.effectiveTo >= date.slice(0,10)) && row.weekdays.includes(weekday)) ?? null;
  }
  async forEmployeeProfile(employeeId: number, date?: string) {
    const rows = await this.assignments.find({ where: { employeeId }, relations: { shift: true }, order: { effectiveFrom: 'DESC' } });
    return date ? rows.find(row => (!row.effectiveTo || row.effectiveTo >= date) && row.weekdays.includes(new Date(`${date}T12:00:00`).getDay())) ?? null : rows;
  }
}
