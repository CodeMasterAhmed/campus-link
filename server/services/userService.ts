import { UserRepository } from '../repos/userRepository';
import bcrypt from 'bcryptjs';

const userRepo = new UserRepository();

export class UserService {
  async registerStudent(payload: { name: string; email: string; password: string; collegeId: number }) {
    const existing = await userRepo.findByEmail(payload.email);
    if (existing) throw new Error('User already exists');
    const passwordHash = await bcrypt.hash(payload.password, 10);
    const user = await userRepo.create({
      name: payload.name,
      email: payload.email,
      passwordHash,
      role: 'STUDENT',
      collegeId: payload.collegeId,
    });
    return user;
  }

  async findByEmail(email: string) {
    return userRepo.findByEmail(email);
  }
}
