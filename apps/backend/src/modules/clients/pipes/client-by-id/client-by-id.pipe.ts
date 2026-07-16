import { Injectable, NotFoundException, PipeTransform } from '@nestjs/common';
import { Client } from '@prisma/client';
import { ClientsService } from '../../clients.service';

@Injectable()
export class ClientByIdPipe implements PipeTransform {
  constructor(private readonly clientsService: ClientsService) {}

  async transform(value: string): Promise<Client> {
    const client = await this.clientsService.findOneById(+value);
    if (!client) {
      throw new NotFoundException(`Client with id ${value} was not found`);
    }
    return client;
  }
}
