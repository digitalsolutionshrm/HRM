import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Employee } from './employee.entity';

@Entity('employee_addresses')
export class EmployeeAddress {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(
    () => Employee,
    (employee) => employee.addresses,
    {
      nullable: false,
      onDelete: 'CASCADE',
    },
  )
  @JoinColumn({ name: 'employee_id' })
  employee!: Employee;

  @Column()
  addressType!: string;
  // CURRENT / PERMANENT

  @Column({ nullable: true })
  addressLine1?: string;

  @Column({ nullable: true })
  addressLine2?: string;

  @Column({ nullable: true })
  city?: string;

  @Column({ nullable: true })
  state?: string;

  @Column({ nullable: true })
  country?: string;

  @Column({ nullable: true })
  postalCode?: string;

  @Column({ default: false })
  isPrimary!: boolean;
}