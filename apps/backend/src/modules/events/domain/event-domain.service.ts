import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';

@Injectable()
export class EventDomainService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureClientCanBeDeleted(clientId: number): Promise<void> {
    const count = await this.prisma.event.count({
      where: { clientId, status: 'activo', deletedAt: null },
    });

    if (count > 0) {
      throw new ConflictException('Client has active events, cannot be deleted');
    }
  }

  async ensurePlaceCanBeDeleted(placeId: number): Promise<void> {
    const count = await this.prisma.event.count({
      where: { placeId, status: 'activo', deletedAt: null },
    });

    if (count > 0) {
      throw new ConflictException('Place has active events, cannot be deleted');
    }
  }
}
