import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Employee } from './employee.entity';

@Entity('employee_documents')
export class EmployeeDocument {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(
    () => Employee,
    (employee) => employee.documents,
    {
      nullable: false,
      onDelete: 'CASCADE',
    },
  )
  @JoinColumn({ name: 'employee_id' })
  employee!: Employee;

  @Column()
  documentType!: string;

  @Column()
  documentName!: string;

  @Column()
  filePath!: string;

  @Column({ nullable: true })
  originalFileName?: string;

  @Column({ nullable: true })
  mimeType?: string;

  @Column({ type: 'bigint', nullable: true })
  fileSize?: number;

  @Column({ nullable: true })
  documentNumber?: string;

  @Column({ type: 'date', nullable: true })
  issueDate?: Date;

  @Column({ type: 'date', nullable: true })
  expiryDate?: Date;

  @Column({ default: true })
  status!: boolean;

  @CreateDateColumn()
  createdAt!: Date;
}