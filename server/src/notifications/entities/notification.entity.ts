import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum NotificationType {
  // General
  GENERAL = 'GENERAL',

  // In-app notifications
  LEAVE = 'LEAVE',
  ATTENDANCE = 'ATTENDANCE',
  DSR = 'DSR',
  PAYROLL = 'PAYROLL',
  EMPLOYEE = 'EMPLOYEE',

  // System
  SYSTEM = 'SYSTEM',

  // Email notifications
  EMAIL_VERIFICATION = 'EMAIL_VERIFICATION',
  PASSWORD_RESET = 'PASSWORD_RESET',
  LEAVE_APPROVED = 'LEAVE_APPROVED',
  LEAVE_REJECTED = 'LEAVE_REJECTED',
  DSR_SUBMITTED = 'DSR_SUBMITTED',
  PAYROLL_GENERATED = 'PAYROLL_GENERATED',
  ACCOUNT_CREATED = 'ACCOUNT_CREATED',
}

@Entity('notifications')
@Index('IDX_notifications_user_created', ['userId', 'createdAt'])
@Index('IDX_notifications_user_read_created', ['userId', 'isRead', 'createdAt'])
@Index('IDX_notifications_user_dedupe', ['userId', 'dedupeKey'], {
  unique: true,
})
export class Notification {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  userId!: number;

  @Column({ type: 'varchar', nullable: true, select: false })
  email?: string | null;

  @Column()
  title!: string;

  @Column({ type: 'text' })
  message!: string;

  @Column({
    type: 'enum',
    enum: NotificationType,
    default: NotificationType.GENERAL,
  })
  type!: NotificationType;

  @Column({ default: false })
  isRead!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  readAt!: Date | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  relatedEntityType?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  relatedEntityId?: string;

  @Column({ type: 'varchar', length: 24, nullable: true })
  announcementAuthorRole?: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  url?: string;

  @Column({ type: 'varchar', length: 180, nullable: true })
  dedupeKey?: string;

  @Column({ type: 'timestamptz', nullable: true })
  expiresAt?: Date | null;

  @Column({ default: false })
  emailSent!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
