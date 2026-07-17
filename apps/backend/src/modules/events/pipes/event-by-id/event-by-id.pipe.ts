import { Injectable, NotFoundException, PipeTransform } from '@nestjs/common';
import { Event } from '@prisma/client';
import { PrismaService } from '../../../../common/prisma/prisma.service';

@Injectable()
export class EventByIdPipe implements PipeTransform {
  constructor(private readonly prisma: PrismaService) {}

  async transform(value: string): Promise<Event> {
    const event = await this.prisma.event.findFirst({
      where: { id: +value, status: 'activo', deletedAt: null },
    });
    if (!event) {
      throw new NotFoundException('Event not found');
    }
    return event;
  }
}
