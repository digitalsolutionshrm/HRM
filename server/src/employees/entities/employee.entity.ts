import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { User } from '../../users/entities/user.entity';
import { Department } from '../../departments/entities/department.entity';
import { EmployeePersonalDetails } from './employee-personal-details.entity';
import { EmployeeAddress } from './employee-address.entity';
import { EmployeeDocument } from './employee-document.entity';
import { EmployeeRole } from '../../roles/entities/employee-role.entity';

@Entity('employees')
export class Employee {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  employeeCode!: string;

  @Column()
  firstName!: string;

  @Column()
  lastName!: string;

  @Column({ nullable: true })
  phone?: string;

  @Column({ name: 'phone_country_code', nullable: true })
  phoneCountryCode?: string;

  @Column({ nullable: true })
  designation?: string;

  @Column({ type: 'date', nullable: true })
  joiningDate?: Date;

  /** Monthly gross salary, used as the basis for automatic payroll. */
  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  salary?: number;

  @Column({ default: true })
  status!: boolean;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  performance?: number;

  // Profile image used for employee profile / optional face verification.
  @Column({ nullable: true })
  profileImage?: string;

  @Column({ type: 'bytea', nullable: true, select: false })
  profileImageData?: Buffer | null;

  @Column({
    name: 'profile_image_mime_type',
    type: 'varchar',
    length: 50,
    nullable: true,
    select: false,
  })
  profileImageMimeType?: string | null;

  @Column({ type: 'varchar', nullable: true })
  coverImage?: string | null;

  // Encrypted biometric template and explicit consent record. Never return these fields in ordinary queries.
  @Column({ name: 'face_descriptor_encrypted', type: 'text', nullable: true, select: false })
  faceDescriptorEncrypted?: string | null;

  @Column({ name: 'face_consent_at', type: 'timestamptz', nullable: true })
  faceConsentAt?: Date | null;

  // Random, private token encoded in the employee's attendance QR code.
  // select:false prevents this credential from leaking in normal employee responses.
  @Column({ name: 'attendance_qr_token', type: 'varchar', length: 64, nullable: true, select: false, unique: true })
  attendanceQrToken?: string | null;

  // User account
  @OneToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  // Department
  @ManyToOne(
    () => Department,
    (department) => department.employees,
    {
      nullable: true,
    },
  )
  @JoinColumn({ name: 'department_id' })
  department?: Department;

  @ManyToOne(
    () => EmployeeRole,
    (jobRole) => jobRole.employees,
    { nullable: true, onDelete: 'RESTRICT' },
  )
  @JoinColumn({ name: 'role_id' })
  jobRole?: EmployeeRole | null;

  @ManyToOne(() => Employee, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'manager_id' })
  manager?: Employee | null;

  // Personal details
  @OneToOne(
    () => EmployeePersonalDetails,
    (personalDetails) => personalDetails.employee,
    {
      cascade: true,
    },
  )
  personalDetails?: EmployeePersonalDetails;

  

  // Addresses
  @OneToMany(
    () => EmployeeAddress,
    (address) => address.employee,
    {
      cascade: true,
    },
  )
  addresses?: EmployeeAddress[];

  // Documents
  @OneToMany(
    () => EmployeeDocument,
    (document) => document.employee,
    {
      cascade: true,
    },
  )
  documents?: EmployeeDocument[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
