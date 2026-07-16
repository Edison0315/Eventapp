import { Body, Controller, Delete, Get, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { Client } from '@prisma/client';
import { buildResponse } from '../../common/helpers/build-response';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { ClientByIdPipe } from './pipes/client-by-id/client-by-id.pipe';

@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  async findAll() {
    const clients = await this.clientsService.findAllActive();
    return buildResponse(HttpStatus.OK, 'ok', clients);
  }

  @Get(':id')
  findOne(@Param('id', ClientByIdPipe) client: Client) {
    return buildResponse(HttpStatus.OK, 'ok', [client]);
  }

  @Post()
  async create(@Body() dto: CreateClientDto) {
    const client = await this.clientsService.create(dto);
    return buildResponse(HttpStatus.CREATED, 'created', [client]);
  }

  @Patch(':id')
  async update(
    @Param('id', ClientByIdPipe) client: Client,
    @Body() dto: UpdateClientDto,
  ) {
    const updated = await this.clientsService.update(client, dto);
    return buildResponse(HttpStatus.OK, 'updated', [updated]);
  }

  @Delete(':id')
  async remove(@Param('id', ClientByIdPipe) client: Client) {
    const deleted = await this.clientsService.softDelete(client);
    return buildResponse(HttpStatus.OK, 'deleted', [deleted]);
  }
}
