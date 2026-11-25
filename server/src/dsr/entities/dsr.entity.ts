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

export enum DsrStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

@Entity('dsrs')
export class Dsr {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Employee, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'employee_id' })
  employee!: Employee;

  @Column({ type: 'date' })
  date!: string;

  @Column({ length: 255 })
  title!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'text', nullable: true })
  tasksCompleted!: string;

  @Column({ type: 'text', nullable: true })
  tasksStatus!: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  hoursWorked!: number;

  @Column({
    type: 'enum',
    enum: DsrStatus,
    default: DsrStatus.DRAFT,
  })
  status!: DsrStatus;

  @Column({ type: 'text', nullable: true })
  managerComment?: string;

  @Column({ type: 'boolean', default: false })
  employeeEditAllowed!: boolean;

  @Column({ type: 'integer', nullable: true })
  employeeEditGrantedByUserId!: number | null;

  @Column({ type: 'timestamptz', nullable: true })
  employeeEditGrantedAt!: Date | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
