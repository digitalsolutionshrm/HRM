import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { User } from '../../users/entities/user.entity';
import { Shift } from '../../shifts/entities/shift.entity';

export enum AttendanceStatus {
  PRESENT = 'PRESENT',
  ABSENT = 'ABSENT',
  HALF_DAY = 'HALF_DAY',
  LATE = 'LATE',
  SHORT_LEAVE = 'SHORT_LEAVE',
  ON_LEAVE = 'ON_LEAVE',
}

export enum OvertimeApprovalStatus {
  NONE = 'NONE',
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

@Entity('attendance')
export class Attendance {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employee_id' })
  employee!: User;

  @Column({ name: 'employee_id' })
  employeeId!: number;

  @ManyToOne(() => Shift, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'shift_id' })
  shift!: Shift | null;

  @Column({ name: 'shift_id', nullable: true })
  shiftId!: number | null;

  @Column({ name: 'shift_name_snapshot', type: 'varchar', length: 100, nullable: true })
  shiftNameSnapshot!: string | null;

  @Column({ name: 'shift_start_snapshot', type: 'time', nullable: true })
  shiftStartSnapshot!: string | null;

  @Column({ name: 'shift_end_snapshot', type: 'time', nullable: true })
  shiftEndSnapshot!: string | null;

  @Column({ name: 'shift_work_hours_snapshot', type: 'decimal', precision: 4, scale: 2, nullable: true })
  shiftWorkHoursSnapshot!: number | null;

  @Column({ type: 'date' })
  date!: string;

  @Column({
    type: 'enum',
    enum: AttendanceStatus,
    enumName: 'attendance_status_enum',
    default: AttendanceStatus.PRESENT,
  })
  status!: AttendanceStatus;

  @Column({ type: 'timestamp', nullable: true })
  checkIn!: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  checkOut!: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  breakStart!: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  breakEnd!: Date | null;

  @Column({ type: 'int', default: 0 })
  breakMinutes!: number;

  @Column({
    name: 'overtime_approval_status',
    type: 'varchar',
    length: 20,
    default: OvertimeApprovalStatus.NONE,
  })
  overtimeApprovalStatus!: OvertimeApprovalStatus;

  @Column({ name: 'overtime_requested_at', type: 'timestamptz', nullable: true })
  overtimeRequestedAt!: Date | null;

  @Column({ name: 'overtime_reviewed_at', type: 'timestamptz', nullable: true })
  overtimeReviewedAt!: Date | null;

  @Column({ name: 'overtime_reviewed_by_user_id', type: 'integer', nullable: true })
  overtimeReviewedByUserId!: number | null;

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  workingHours!: number | null;

  @Column({ type: 'text', nullable: true })
  remarks!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
