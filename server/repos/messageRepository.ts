import { BaseRepository } from './baseRepository';

export class MessageRepository extends BaseRepository {
  async createMessage(data: { collegeId: number; senderId: number; receiverId: number; body: string }) {
    return this.db.message.create({
      data,
      include: {
        sender: {
          select: { id: true, name: true, role: true },
        },
        receiver: {
          select: { id: true, name: true, role: true },
        },
      },
    });
  }

  async getConversation(userA: number, userB: number) {
    return this.db.message.findMany({
      where: {
        OR: [
          { senderId: userA, receiverId: userB },
          { senderId: userB, receiverId: userA },
        ],
      },
      orderBy: { createdAt: 'asc' },
      include: {
        sender: {
          select: { id: true, name: true, role: true },
        },
        receiver: {
          select: { id: true, name: true, role: true },
        },
      },
    });
  }
}
