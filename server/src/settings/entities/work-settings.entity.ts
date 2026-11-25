import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Company-wide attendance rules (a single row).
 *  - officeStartTime / officeEndTime: expected working window (HH:mm).
 *  - graceMinutes: minutes after officeStartTime before a check-in is short leave.
 *  - standardWorkHours: full working day duration, used for half-day detection.
 *  - paidLeavesPerMonth: leaves beyond this count are deducted from salary.
 *  - weeklyOffDays: 0=Sunday ... 6=Saturday.
 */
@Entity('work_settings')
export class WorkSettings {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'time', default: '09:30:00' })
  officeStartTime!: string;

  @Column({ type: 'time', default: '18:30:00' })
  officeEndTime!: string;

  @Column({ type: 'int', default: 30 })
  graceMinutes!: number;

  @Column({ type: 'decimal', precision: 4, scale: 2, default: 8 })
  standardWorkHours!: number;

  @Column({ type: 'int', default: 2 })
  paidLeavesPerMonth!: number;

  @Column({ type: 'int', array: true, default: '{0}' })
  weeklyOffDays!: number[];

  @UpdateDateColumn()
  updatedAt!: Date;
}
