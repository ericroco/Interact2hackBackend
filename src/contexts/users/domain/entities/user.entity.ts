import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 20 })
  phone: string;

  @Column({ type: 'varchar', unique: true, nullable: true, length: 255 })
  email: string | null;

  @Column({ name: 'full_name', length: 150 })
  fullName: string;

  @Column({ name: 'password_hash', length: 255 })
  passwordHash: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ type: 'decimal', precision: 10, scale: 6, default: 0 })
  latitude: number;

  @Column({ type: 'decimal', precision: 10, scale: 6, default: 0 })
  longitude: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
