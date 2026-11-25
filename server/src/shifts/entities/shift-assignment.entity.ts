import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Employee } from '../../employees/entities/employee.entity';
import { Shift } from './shift.entity';

@Entity('shift_assignments')
export class ShiftAssignment {
  @PrimaryGeneratedColumn() id!: number;
  @ManyToOne(() => Employee, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employee_id' }) employee!: Employee;
  @Column({ name: 'employee_id' }) employeeId!: number;
  @ManyToOne(() => Shift, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'shift_id' }) shift!: Shift;
  @Column({ name: 'shift_id' }) shiftId!: number;
  @Column({ type: 'date' }) effectiveFrom!: string;
  @Column({ type: 'date', nullable: true }) effectiveTo!: string | null;
  @Column({ type: 'int', array: true, default: '{1,2,3,4,5,6,0}' }) weekdays!: number[];
  @Column({ type: 'text', nullable: true }) note!: string | null;
  @CreateDateColumn() createdAt!: Date;
}
