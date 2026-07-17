import { Body, Controller, Delete, Get, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { Place } from '@prisma/client';
import { buildResponse } from '../../common/helpers/build-response';
import { CreatePlaceDto } from './dto/create-place.dto';
import { UpdatePlaceDto } from './dto/update-place.dto';
import { PlaceByIdPipe } from './pipes/place-by-id/place-by-id.pipe';
import { PlacesService } from './places.service';

@Controller('places')
export class PlacesController {
  constructor(private readonly placesService: PlacesService) {}

  @Get()
  async findAll() {
    const places = await this.placesService.findAllActive();
    return buildResponse(HttpStatus.OK, 'ok', places);
  }

  @Get(':id')
  findOne(@Param('id', PlaceByIdPipe) place: Place) {
    return buildResponse(HttpStatus.OK, 'ok', [place]);
  }

  @Post()
  async create(@Body() dto: CreatePlaceDto) {
    const place = await this.placesService.create(dto);
    return buildResponse(HttpStatus.CREATED, 'created', [place]);
  }

  @Patch(':id')
  async update(
    @Param('id', PlaceByIdPipe) place: Place,
    @Body() dto: UpdatePlaceDto,
  ) {
    const updated = await this.placesService.update(place, dto);
    return buildResponse(HttpStatus.OK, 'updated', [updated]);
  }

  @Delete(':id')
  async remove(@Param('id', PlaceByIdPipe) place: Place) {
    const deleted = await this.placesService.softDelete(place);
    return buildResponse(HttpStatus.OK, 'deleted', [deleted]);
  }
}
