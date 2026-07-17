import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/**
 * Prisma Client Extension that enforces "no overlapping events at the same
 * place" as a cross-cutting write-time rule, keeping `EventsService` free of
 * this concern.
 *
 * Half-open range semantics `[dateStart, dateEnd)`: two events at the same
 * place do NOT overlap when one ends exactly when the other starts. Overlap
 * is only checked when the (final) `placeId` is non-null — events without a
 * fixed place never compete for the resource.
 *
 * IMPORTANT: this extension must only be applied to the Prisma Client
 * instance consumed by `EventsService` (see step 10) — never to the global
 * `PrismaService` — so it does not affect other modules.
 */
export const eventOverlapExtension = Prisma.defineExtension((client) => {
  return client.$extends({
    name: 'eventOverlap',
    query: {
      event: {
        async create({ args, query }) {
          const placeId = args.data.placeId;

          if (placeId != null) {
            const dateStart = args.data.dateStart as Date;
            const dateEnd = args.data.dateEnd as Date;

            const conflict = await client.event.findFirst({
              where: {
                placeId,
                status: 'activo',
                deletedAt: null,
                dateStart: { lt: dateEnd },
                dateEnd: { gt: dateStart },
              },
            });

            if (conflict) {
              throw new ConflictException('Event overlaps with existing event at same place');
            }
          }

          return query(args);
        },

        async update({ args, query }) {
          const targetId = (args.where as Prisma.EventWhereUniqueInput).id;

          if (targetId != null) {
            const current = await client.event.findFirst({ where: { id: targetId } });

            const data = args.data as Prisma.EventUncheckedUpdateInput;

            const placeId = Object.prototype.hasOwnProperty.call(data, 'placeId')
              ? (data.placeId as number | null | undefined)
              : current?.placeId ?? null;
            const dateStart = Object.prototype.hasOwnProperty.call(data, 'dateStart')
              ? (data.dateStart as Date)
              : (current?.dateStart as Date);
            const dateEnd = Object.prototype.hasOwnProperty.call(data, 'dateEnd')
              ? (data.dateEnd as Date)
              : (current?.dateEnd as Date);

            if (placeId != null) {
              const conflict = await client.event.findFirst({
                where: {
                  placeId,
                  status: 'activo',
                  deletedAt: null,
                  id: { not: targetId },
                  dateStart: { lt: dateEnd },
                  dateEnd: { gt: dateStart },
                },
              });

              if (conflict) {
                throw new ConflictException('Event overlaps with existing event at same place');
              }
            }
          }

          return query(args);
        },
      },
    },
  });
});
