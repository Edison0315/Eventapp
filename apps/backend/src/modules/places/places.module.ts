import { Module } from '@nestjs/common';
import { PlaceByIdPipe } from './pipes/place-by-id/place-by-id.pipe';
import { PlacesController } from './places.controller';
import { PlacesService } from './places.service';

@Module({
  controllers: [PlacesController],
  providers: [PlacesService, PlaceByIdPipe],
  exports: [PlacesService],
})
export class PlacesModule {}
