import { UserEntity } from '../entities/user.entity';

export interface UserRepositoryPort {
  findById(id: string): Promise<UserEntity | null>;
  findByPhone(phone: string): Promise<UserEntity | null>;
  save(user: Omit<UserEntity, 'id' | 'createdAt' | 'updatedAt'>): Promise<UserEntity>;
}

export const USER_REPOSITORY = 'USER_REPOSITORY';
