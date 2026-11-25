import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Employee } from './employee.entity';

@Entity('employee_personal_details')
export class EmployeePersonalDetails {
  @PrimaryGeneratedColumn()
  id!: number;

  @OneToOne(() => Employee, (employee) => employee.personalDetails, {
    // nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'employee_id' })
  employee!: Employee;

  @Column({ type: 'date', nullable: true })
  dateOfBirth?: Date | null;

  @Column({ nullable: true })
  gender?: string;

  @Column({ nullable: true })
  maritalStatus?: string;

  @Column({ nullable: true })
  nationality?: string;

  @Column({ nullable: true })
  bloodGroup?: string;

  @Column({ nullable: true })
  personalEmail?: string;

  @Column({ nullable: true })
  alternatePhone?: string;

  @Column({ nullable: true })
  fatherName?: string;

  @Column({ nullable: true })
  husbandName?: string;

  @Column({ nullable: true })
  motherName?: string;

  @Column({ nullable: true })
  emergencyContactName?: string;

  @Column({ nullable: true })
  emergencyContactPhone?: string;

  @Column({ nullable: true })
  emergencyContactRelation?: string;

  @UpdateDateColumn()
  updatedAt!: Date;
}
