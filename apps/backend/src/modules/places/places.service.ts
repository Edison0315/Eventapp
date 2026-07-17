import { ConflictException, Injectable } from '@nestjs/common';
import { Place, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EventDomainService } from '../events/domain/event-domain.service';
import { CreatePlaceDto } from './dto/create-place.dto';
import { UpdatePlaceDto } from './dto/update-place.dto';

@Injectable()
export class PlacesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventDomain: EventDomainService,
  ) {}

  findAllActive(): Promise<Place[]> {
    return this.prisma.place.findMany({
      where: { status: 'activo', deletedAt: null },
      orderBy: { id: 'asc' },
    });
  }

  findOneById(id: number): Promise<Place | null> {
    return this.prisma.place.findFirst({
      where: { id, status: 'activo', deletedAt: null },
    });
  }

  async create(dto: CreatePlaceDto): Promise<Place> {
    const email = dto.email.toLowerCase().trim();

    await this.assertUniqueName(dto.name);

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const entity = await tx.entity.create({ data: { type: 'place' } });
          return tx.place.create({
            data: {
              id: entity.id,
              name: dto.name,
              address: dto.address,
              ubication: dto.ubication,
              email,
              phone: dto.phone,
              status: 'activo',
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
      );
    } catch (error) {
      throw this.mapUniqueViolation(error);
    }
  }

  async update(place: Place, dto: UpdatePlaceDto): Promise<Place> {
    const email = dto.email ? dto.email.toLowerCase().trim() : undefined;

    if (dto.name) {
      await this.assertUniqueName(dto.name, place.id);
    }

    try {
      return await this.prisma.place.update({
        where: { id: place.id },
        data: { ...dto, ...(email ? { email } : {}) },
      });
    } catch (error) {
      throw this.mapUniqueViolation(error);
    }
  }

  async softDelete(place: Place): Promise<Place> {
    await this.eventDomain.ensurePlaceCanBeDeleted(place.id);

    return this.prisma.place.update({
      where: { id: place.id },
      data: { deletedAt: new Date(), status: 'inactivo' },
    });
  }

  private async assertUniqueName(name: string, excludeId?: number): Promise<void> {
    const existing = await this.prisma.place.findFirst({
      where: { name, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
    });
    if (existing) {
      throw new ConflictException('Place with this name already exists');
    }
  }

  private mapUniqueViolation(error: unknown): unknown {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const target = (error.meta?.target as string[] | undefined)?.join(', ') ?? 'field';
      return new ConflictException(`Place with this ${target} already exists`);
    }
    return error;
  }
}
