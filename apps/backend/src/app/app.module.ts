import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { AllExceptionsFilter } from '../common/filters/all-exceptions/all-exceptions.filter';
import { PrismaModule } from '../common/prisma/prisma.module';
import { ClientsModule } from '../modules/clients/clients.module';
import { EventsModule } from '../modules/events/events.module';
import { PlacesModule } from '../modules/places/places.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [PrismaModule, ClientsModule, PlacesModule, EventsModule],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
