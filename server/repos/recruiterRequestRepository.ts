import { BaseRepository } from './baseRepository';
import type { Prisma } from '@prisma/client';

export class RecruiterRequestRepository extends BaseRepository {
  async createRequest(data: { recruiterId: number; targetCollegeId: number; reason?: string }) {
    return this.db.recruiterCollegeRequest.create({ data });
  }

  async listPending() {
    return this.db.recruiterCollegeRequest.findMany({ where: { status: 'PENDING' } });
  }

  async resolve(id: number, status: 'APPROVED' | 'REJECTED', resolvedByAdminId?: number) {
    const data: Prisma.RecruiterCollegeRequestUncheckedUpdateInput = {
      status,
      resolvedAt: new Date(),
      resolvedByAdminId,
    };
    return this.db.recruiterCollegeRequest.update({ where: { id }, data });
  }
}
