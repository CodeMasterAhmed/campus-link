import { CollegeRepository } from '../repos/collegeRepository';

const repo = new CollegeRepository();

export class CollegeService {
  async createCollege(payload: { name: string; emailDomain: string; code: string; isActive?: boolean }) {
    const existing = await repo.findByEmailDomain(payload.emailDomain);
    if (existing) throw new Error('College with this domain already exists');

    // Check if code exists
    // Note: Repository doesn't have findByCode, but database enforces unique constraint.
    // We can let the DB throw or add a check here if needed.

    return repo.create({
      name: payload.name,
      emailDomain: payload.emailDomain,
      code: payload.code,
      isActive: payload.isActive ?? true
    });
  }

  async findByEmailDomain(domain: string) {
    return repo.findByEmailDomain(domain);
  }

  async findByCode(code: string) {
    return repo.findByCode(code);
  }

  async findById(id: number) {
    return repo.findById(id);
  }

  async listAll() {
    return repo.listAll();
  }
}
