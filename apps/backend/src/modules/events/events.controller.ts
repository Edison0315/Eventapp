import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Event } from '@prisma/client';
import { buildResponse } from '../../common/helpers/build-response';
import { CreateEventDto } from './dto/create-event.dto';
import { ListEventsQueryDto } from './dto/list-events-query.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EventByIdPipe } from './pipes/event-by-id/event-by-id.pipe';
import { EventsService } from './events.service';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  async findAll(@Query() q: ListEventsQueryDto) {
    const events = await this.eventsService.findAll(q);
    return buildResponse(HttpStatus.OK, 'ok', events);
  }

  @Get(':id')
  findOne(@Param('id', EventByIdPipe) event: Event) {
    return buildResponse(HttpStatus.OK, 'ok', [event]);
  }

  @Post()
  async create(@Body() dto: CreateEventDto) {
    const event = await this.eventsService.create(dto);
    return buildResponse(HttpStatus.CREATED, 'created', [event]);
  }

  @Patch(':id')
  async update(
    @Param('id', EventByIdPipe) event: Event,
    @Body() dto: UpdateEventDto,
  ) {
    const updated = await this.eventsService.update(event, dto);
    return buildResponse(HttpStatus.OK, 'updated', [updated]);
  }

  @Delete(':id')
  async remove(@Param('id', EventByIdPipe) event: Event) {
    const deleted = await this.eventsService.softDelete(event);
    return buildResponse(HttpStatus.OK, 'deleted', [deleted]);
  }
}
