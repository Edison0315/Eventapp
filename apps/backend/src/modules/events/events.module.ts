import { Module } from '@nestjs/common';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { EventByIdPipe } from './pipes/event-by-id/event-by-id.pipe';
import { EventDomainService } from './domain/event-domain.service';

@Module({
  controllers: [EventsController],
  providers: [EventsService, EventByIdPipe, EventDomainService],
  exports: [EventsService, EventDomainService],
})
export class EventsModule {}
