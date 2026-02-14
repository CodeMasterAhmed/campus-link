import { BaseRepository } from './baseRepository';
import type { Prisma } from '@prisma/client';

export class StudentProfileRepository extends BaseRepository {
  async create(data: Prisma.StudentProfileCreateInput) {
    return this.db.studentProfile.create({ data });
  }

  async findByUserId(userId: number) {
    return this.db.studentProfile.findUnique({ where: { userId } });
  }

  async update(id: number, data: Prisma.StudentProfileUpdateInput) {
    return this.db.studentProfile.update({ where: { id }, data });
  }

  async leaderboardForCollege(collegeId: number, limit = 50, skip = 0) {
    return this.db.studentProfile.findMany({
      take: limit,
      skip,
      orderBy: { ussScore: 'desc' },
      include: { user: true, academic: true },
      where: { user: { collegeId } },
    });
  }

  async countForCollege(collegeId: number) {
    return this.db.studentProfile.count({ where: { user: { collegeId } } });
  }
}
