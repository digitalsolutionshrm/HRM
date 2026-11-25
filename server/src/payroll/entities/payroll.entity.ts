import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';

import { Employee } from '../../employees/entities/employee.entity';

export enum PayrollStatus {
  PENDING = 'PENDING',
  PROCESSED = 'PROCESSED',
  PAID = 'PAID',
}

@Entity('payroll')
@Unique(['employeeId', 'month', 'year'])
export class Payroll {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  employeeId!: number;

  @ManyToOne(() => Employee, {
    onDelete: 'CASCADE',
    eager: false,
  })
  @JoinColumn({ name: 'employeeId' })
  employee!: Employee;

  @Column({ type: 'int' })
  month!: number;

  @Column({ type: 'int' })
  year!: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
  })
  basicSalary?: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
  })
  hra?: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
  })
  allowances?: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
  })
  bonus?: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
  })
  overtime?: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
  })
  overtimeHours!: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
  })
  attendanceDeductions!: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
  })
  leaveDeductions!: number;

  @Column({ type: 'int', default: 0 })
  attendanceDays!: number;

  @Column({ type: 'int', default: 0 })
  absentDays!: number;

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 1,
    default: 0,
  })
  halfDays!: number;

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 1,
    default: 0,
  })
  leaveDays!: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
  })
  grossSalary!: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
  })
  tax?: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
  })
  pf?: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
  })
  esi?: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
  })
  otherDeductions!: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
  })
  totalDeductions!: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
  })
  netSalary!: number;

  @Column({
    type: 'enum',
    enum: PayrollStatus,
    default: PayrollStatus.PENDING,
  })
  status!: PayrollStatus;

  @Column({ type: 'boolean', default: false })
  isApproved!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  approvedAt!: Date | null;

  @Column({ type: 'int', nullable: true })
  approvedByUserId!: number | null;

  @Column({
    type: 'timestamp',
    nullable: true,
  })
  paymentDate!: Date | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
