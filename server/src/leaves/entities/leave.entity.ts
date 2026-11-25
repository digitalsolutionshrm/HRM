import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Employee } from '../../employees/entities/employee.entity';

export enum LeaveType {
  CASUAL = 'CASUAL',
  SICK = 'SICK',
  ANNUAL = 'ANNUAL',
  UNPAID = 'UNPAID',
  OTHER = 'OTHER',
}

export enum LeaveStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

export enum LeaveDuration {
  FULL_DAY = 'FULL_DAY',
  HALF_DAY = 'HALF_DAY',
  SHORT_LEAVE = 'SHORT_LEAVE',
}

@Entity('leaves')
export class Leave {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  employeeId!: number;

  @ManyToOne(() => Employee, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'employeeId',
  })
  employee!: Employee;

  @Column({
    type: 'enum',
    enum: LeaveType,
  })
  leaveType!: LeaveType;

  @Column({
    type: 'date',
  })
  startDate!: string;

  @Column({
    type: 'date',
  })
  endDate!: string;

  @Column({
    type: 'text',
  })
  reason!: string;

  @Column({
    type: 'enum',
    enum: LeaveDuration,
    default: LeaveDuration.FULL_DAY,
  })
  leaveDuration!: LeaveDuration;

  @Column({
  type: 'time',
  nullable: true,
  })
  startTime!: string | null;

  @Column({
    type: 'time',
    nullable: true,
  })
  endTime!: string | null;

  @Column({
    type: 'enum',
    enum: LeaveStatus,
    default: LeaveStatus.PENDING,
  })
  status!: LeaveStatus;

  @Column({
    type: 'text',
    nullable: true,
  })
  rejectionReason!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;


}