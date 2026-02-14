import { MessageRepository } from '../repos/messageRepository';

const repo = new MessageRepository();

export class MessageService {
  async sendMessage(collegeId: number, senderId: number, receiverId: number, body: string) {
    return repo.createMessage({ collegeId, senderId, receiverId, body });
  }

  async getConversation(userA: number, userB: number) {
    return repo.getConversation(userA, userB);
  }
}
