import { Injectable, NotFoundException } from '@nestjs/common';
import { Event, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';
import { ListEventsQueryDto } from './dto/list-events-query.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { eventOverlapExtension } from './extensions/event-overlap.extension';

@Injectable()
export class EventsService {
  /**
   * Prisma Client instance extended with `eventOverlapExtension`, used
   * exclusively by this service for `event.*` operations. The shared
   * `PrismaService` is intentionally left unextended so other modules
   * (`ClientsService`, `PlacesService`, seed, etc.) are unaffected.
   */
  private readonly extendedPrisma = this.prisma.$extends(eventOverlapExtension);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ListEventsQueryDto): Promise<Event[]> {
    const { clientId, placeId, status, from, to } = query;

    const where: Prisma.EventWhereInput = {
      deletedAt: null,
      status: status ?? 'activo',
    };

    if (clientId !== undefined) {
      where.clientId = clientId;
    }

    if (placeId !== undefined) {
      where.placeId = placeId;
    }

    if (from !== undefined && to !== undefined) {
      where.dateStart = { lt: new Date(to) };
      where.dateEnd = { gt: new Date(from) };
    } else if (from !== undefined) {
      where.dateEnd = { gt: new Date(from) };
    } else if (to !== undefined) {
      where.dateStart = { lt: new Date(to) };
    }

    return this.prisma.event.findMany({
      where,
      orderBy: { dateStart: 'asc' },
    });
  }

  async findOneById(id: number): Promise<Event | null> {
    return this.prisma.event.findFirst({ where: { id, deletedAt: null } });
  }

  async create(dto: CreateEventDto): Promise<Event> {
    await this.assertClientExists(dto.clientId);

    if (dto.placeId !== undefined) {
      await this.assertPlaceExists(dto.placeId);
    }

    try {
      return await this.extendedPrisma.$transaction(
        async (tx) => {
          const entity = await tx.entity.create({ data: { type: 'event' } });
          return tx.event.create({
            data: {
              id: entity.id,
              name: dto.name,
              clientId: dto.clientId,
              placeId: dto.placeId,
              dateStart: new Date(dto.dateStart),
              dateEnd: new Date(dto.dateEnd),
              typeEvent: dto.typeEvent,
              status: 'activo',
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
      );
    } catch (error) {
      throw this.mapForeignKeyViolation(error);
    }
  }

  /**
   * Pre-checks are conditional: only fields present in the (partial) dto
   * are validated. `placeId === null` means "clear the place" (events
   * without a fixed venue are allowed) and is intentionally not checked;
   * `placeId === undefined` means the field was not sent at all.
   */
  async update(event: Event, dto: UpdateEventDto): Promise<Event> {
    if (dto.clientId !== undefined) {
      await this.assertClientExists(dto.clientId);
    }

    if (dto.placeId !== undefined && dto.placeId !== null) {
      await this.assertPlaceExists(dto.placeId);
    }

    try {
      return await this.extendedPrisma.event.update({
        where: { id: event.id },
        data: {
          ...dto,
          ...(dto.dateStart && { dateStart: new Date(dto.dateStart) }),
          ...(dto.dateEnd && { dateEnd: new Date(dto.dateEnd) }),
        },
      });
    } catch (error) {
      throw this.mapForeignKeyViolation(error);
    }
  }

  /**
   * Soft-delete does not generate an overlap (the event is being removed
   * from active scheduling, not scheduled), so it intentionally uses the
   * unextended `this.prisma` rather than `this.extendedPrisma`.
   */
  async softDelete(event: Event): Promise<Event> {
    return this.prisma.event.update({
      where: { id: event.id },
      data: { deletedAt: new Date(), status: 'inactivo' },
    });
  }

  /**
   * Read-only pre-checks use the unextended `this.prisma` — no overlap
   * validation is needed for a simple existence lookup.
   */
  private async assertClientExists(clientId: number): Promise<void> {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, status: 'activo', deletedAt: null },
    });
    if (!client) {
      throw new NotFoundException('Client not found');
    }
  }

  private async assertPlaceExists(placeId: number): Promise<void> {
    const place = await this.prisma.place.findFirst({
      where: { id: placeId, status: 'activo', deletedAt: null },
    });
    if (!place) {
      throw new NotFoundException('Place not found');
    }
  }

  /**
   * P2003 (FK violation) as a last-resort safety net — the explicit
   * pre-checks above already cover the named cases (client/place not
   * found), so this only guards against TOCTOU races.
   */
  private mapForeignKeyViolation(error: unknown): unknown {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2003'
    ) {
      return new NotFoundException('Referenced entity not found');
    }
    return error;
  }
}
