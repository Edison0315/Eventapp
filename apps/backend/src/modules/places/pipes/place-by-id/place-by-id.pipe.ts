import { Injectable, NotFoundException, PipeTransform } from '@nestjs/common';
import { Place } from '@prisma/client';
import { PrismaService } from '../../../../common/prisma/prisma.service';

@Injectable()
export class PlaceByIdPipe implements PipeTransform {
  constructor(private readonly prisma: PrismaService) {}

  async transform(value: string): Promise<Place> {
    const place = await this.prisma.place.findFirst({
      where: { id: +value, status: 'activo', deletedAt: null },
    });
    if (!place) {
      throw new NotFoundException('Place not found');
    }
    return place;
  }
}
