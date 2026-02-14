import { BaseRepository } from './baseRepository';
import type { Prisma } from '@prisma/client';

export class UserRepository extends BaseRepository {
  async findById(id: number) {
    return this.db.user.findUnique({ where: { id } });
  }

  async findByEmail(email: string) {
    return this.db.user.findUnique({ where: { email } });
  }

  async create(data: Prisma.UserUncheckedCreateInput | Prisma.UserCreateInput) {
    return this.db.user.create({ data });
  }
}
