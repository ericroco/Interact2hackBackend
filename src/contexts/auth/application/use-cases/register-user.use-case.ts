import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UserRepositoryPort, USER_REPOSITORY } from '@contexts/users/domain/ports/user.repository.port';
import { RegisterUserDto } from '../ports/register-user.dto';

@Injectable()
export class RegisterUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepositoryPort,
    private readonly jwtService: JwtService,
  ) {}

  async execute(dto: RegisterUserDto): Promise<{ accessToken: string; userId: string }> {
    const existing = await this.userRepo.findByPhone(dto.phone);
    if (existing) throw new ConflictException('Phone number already registered');

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.userRepo.save({
      phone: dto.phone,
      fullName: dto.fullName,
      email: dto.email ?? null,
      passwordHash,
      isActive: true,
    });

    const accessToken = this.jwtService.sign({
      sub: user.id,
      phone: user.phone,
      role: 'user',
    });

    return { accessToken, userId: user.id };
  }
}
