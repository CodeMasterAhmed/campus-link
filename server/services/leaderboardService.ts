import { StudentProfileRepository } from '../repos/studentProfileRepository';

const repo = new StudentProfileRepository();

export class LeaderboardService {
  async topForCollege(collegeId: number, limit = 50, page = 1) {
    const perPage = limit;
    const skip = (page - 1) * perPage;
    const items = await repo.leaderboardForCollege(collegeId, perPage, skip);
    // simple total estimate (could be optimized)
    const total = await repo.countForCollege(collegeId);
    return { items, total, page, perPage };
  }
}
