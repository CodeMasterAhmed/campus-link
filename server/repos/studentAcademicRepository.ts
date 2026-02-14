import { BaseRepository } from './baseRepository';
import type { Prisma } from '@prisma/client';

export class StudentAcademicRepository extends BaseRepository {
  async findByCollegeAndRoll(collegeId: number, rollNumber: string) {
    const where: Prisma.StudentAcademicWhereUniqueInput = {
      collegeId_rollNumber: { collegeId, rollNumber },
    };
    return this.db.studentAcademic.findUnique({ where });
  }

  async upsertByCollegeAndRoll(collegeId: number, rollNumber: string, data: Prisma.StudentAcademicUncheckedUpdateInput) {
    const where: Prisma.StudentAcademicWhereUniqueInput = {
      collegeId_rollNumber: { collegeId, rollNumber },
    };
    const createData: Prisma.StudentAcademicUncheckedCreateInput = {
      ...(data as Prisma.StudentAcademicUncheckedCreateInput),
      collegeId,
      rollNumber,
    };
    return this.db.studentAcademic.upsert({
      where,
      create: createData,
      update: data,
    });
  }

  async findById(id: number) {
    return this.db.studentAcademic.findUnique({ where: { id } });
  }
}
