import { ConflictException, Injectable } from '@nestjs/common';
import { Client, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  findAllActive(): Promise<Client[]> {
    return this.prisma.client.findMany({
      where: { status: 'activo', deletedAt: null },
      orderBy: { id: 'asc' },
    });
  }

  /**
   * Existence lookup consumed by `ClientByIdPipe`. Returns `null` when not
   * found — never throws, never wraps with `buildResponse` (skill
   * convention: existence checks live in the pipe, not the service).
   */
  findOneById(id: number): Promise<Client | null> {
    return this.prisma.client.findFirst({
      where: { id, status: 'activo', deletedAt: null },
    });
  }

  async create(dto: CreateClientDto): Promise<Client> {
    const email = dto.email.toLowerCase().trim();

    await this.assertUnique({ nro_doc: dto.nro_doc, email });

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const entity = await tx.entity.create({ data: { type: 'client' } });
          return tx.client.create({
            data: {
              id: entity.id,
              name: dto.name,
              nro_doc: dto.nro_doc,
              address: dto.address,
              ubication: dto.ubication,
              email,
              web: dto.web ?? null,
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

  async update(client: Client, dto: UpdateClientDto): Promise<Client> {
    const email = dto.email ? dto.email.toLowerCase().trim() : undefined;

    await this.assertUnique(
      { nro_doc: dto.nro_doc, email },
      client.id,
    );

    try {
      return await this.prisma.client.update({
        where: { id: client.id },
        data: { ...dto, ...(email ? { email } : {}) },
      });
    } catch (error) {
      throw this.mapUniqueViolation(error);
    }
  }

  softDelete(client: Client): Promise<Client> {
    return this.prisma.client.update({
      where: { id: client.id },
      data: { deletedAt: new Date(), status: 'inactivo' },
    });
  }

  /**
   * Friendlier 409 pre-check before hitting the DB unique indexes.
   * Still followed by a `P2002` catch as a TOCTOU safety net (see risks in
   * the spec).
   */
  private async assertUnique(
    fields: { nro_doc?: string; email?: string },
    excludeId?: number,
  ): Promise<void> {
    const or: Prisma.ClientWhereInput[] = [];
    if (fields.nro_doc) or.push({ nro_doc: fields.nro_doc });
    if (fields.email) or.push({ email: fields.email });
    if (or.length === 0) return;

    const existing = await this.prisma.client.findFirst({
      where: {
        OR: or,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
    });

    if (!existing) return;

    const conflictField = existing.nro_doc === fields.nro_doc ? 'nro_doc' : 'email';
    throw new ConflictException(`Client with this ${conflictField} already exists`);
  }

  private mapUniqueViolation(error: unknown): unknown {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const target = (error.meta?.target as string[] | undefined)?.join(', ') ?? 'field';
      return new ConflictException(`Client with this ${target} already exists`);
    }
    return error;
  }
}
