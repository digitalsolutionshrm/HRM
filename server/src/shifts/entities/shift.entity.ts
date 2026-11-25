import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('shifts')
export class Shift {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ unique: true, length: 40 }) code!: string;
  @Column({ length: 100 }) name!: string;
  @Column({ type: 'time' }) startTime!: string;
  @Column({ type: 'time' }) endTime!: string;
  @Column({ type: 'int', default: 30 }) graceMinutes!: number;
  @Column({ type: 'decimal', precision: 4, scale: 2, default: 8 }) standardWorkHours!: number;
  @Column({ type: 'int', default: 0 }) breakMinutes!: number;
  @Column({ default: true }) active!: boolean;
  @CreateDateColumn() createdAt!: Date;
  @UpdateDateColumn() updatedAt!: Date;
}
