import { BaseRepository } from './baseRepository';
import type { Prisma } from '@prisma/client';

export class CollegeRepository extends BaseRepository {
  async create(data: Prisma.CollegeCreateInput) {
    return this.db.college.create({ data });
  }

  async findById(id: number) {
    return this.db.college.findUnique({ where: { id } });
  }

  async findByEmailDomain(domain: string) {
    return this.db.college.findUnique({ where: { emailDomain: domain } });
  }

  async findByCode(code: string) {
    return this.db.college.findUnique({ where: { code } });
  }

  async listAll() {
    return this.db.college.findMany();
  }
}
