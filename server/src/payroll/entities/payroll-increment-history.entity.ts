import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Employee } from '../../employees/entities/employee.entity';

@Entity('payroll_increment_history')
export class PayrollIncrementHistory {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  employeeId!: number;

  @ManyToOne(() => Employee, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'employeeId' })
  employee!: Employee;

  @Column({ type: 'varchar', length: 150 })
  employeeName!: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  departmentName!: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  previousSalary!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  newSalary!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  increaseAmount!: number;

  @Column({ type: 'decimal', precision: 7, scale: 2 })
  increasePercent!: number;

  @Column({ type: 'date' })
  effectiveDate!: string;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  @Column({ type: 'int' })
  createdByUserId!: number;

  @CreateDateColumn()
  createdAt!: Date;
}
