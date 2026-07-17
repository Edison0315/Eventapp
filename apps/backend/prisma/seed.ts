import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface SeedClient {
  name: string;
  nro_doc: string;
  address: string;
  ubication: string;
  email: string;
  web?: string;
}

const clients: SeedClient[] = [
  {
    name: 'Panaderia El Amanecer S.A.',
    nro_doc: '30-71234567-8',
    address: 'Av. Rivadavia 4521',
    ubication: 'Ciudad Autonoma de Buenos Aires, Argentina',
    email: 'contacto@elamanecer.com.ar',
    web: 'https://www.elamanecer.com.ar',
  },
  {
    name: 'Distribuidora Norte SRL',
    nro_doc: '30-70987654-3',
    address: 'Ruta Nacional 9, Km 45',
    ubication: 'Cordoba Capital, Cordoba, Argentina',
    email: 'ventas@distribuidoranorte.com.ar',
  },
  {
    name: 'Estudio Juridico Fernandez y Asociados',
    nro_doc: '30-69876543-1',
    address: 'Calle San Martin 1024, Piso 3',
    ubication: 'Rosario, Santa Fe, Argentina',
    email: 'info@fernandezasociados.com.ar',
    web: 'https://www.fernandezasociados.com.ar',
  },
];

async function upsertClient(seedClient: SeedClient) {
  const existing = await prisma.client.findUnique({
    where: { nro_doc: seedClient.nro_doc },
  });

  if (existing) {
    return prisma.client.update({
      where: { nro_doc: seedClient.nro_doc },
      data: {
        name: seedClient.name,
        address: seedClient.address,
        ubication: seedClient.ubication,
        email: seedClient.email.toLowerCase(),
        web: seedClient.web ?? null,
      },
    });
  }

  // Entity + Client pair created atomically: either both rows exist or
  // neither does, mirroring ClientsService.create().
  return prisma.$transaction(async (tx) => {
    const entity = await tx.entity.create({ data: { type: 'client' } });
    return tx.client.create({
      data: {
        id: entity.id,
        name: seedClient.name,
        nro_doc: seedClient.nro_doc,
        address: seedClient.address,
        ubication: seedClient.ubication,
        email: seedClient.email.toLowerCase(),
        web: seedClient.web ?? null,
        status: 'activo',
      },
    });
  });
}

interface SeedPlace {
  name: string;
  address: string;
  ubication: string;
  email: string;
  phone: string;
}

const places: SeedPlace[] = [
  {
    name: 'Sala Apolo',
    address: 'Carrer Nou de la Rambla 113, 08004 Barcelona',
    ubication: 'https://maps.google.com/?q=Sala+Apolo+Barcelona',
    email: 'info@sala-apolo.com',
    phone: '+34 934 414 001',
  },
  {
    name: 'La Riviera',
    address: 'Paseo Virgen del Puerto s/n, 28005 Madrid',
    ubication: 'https://maps.google.com/?q=Sala+La+Riviera+Madrid',
    email: 'contacto@salariviera.com',
    phone: '+34 913 653 940',
  },
  {
    name: 'Razzmatazz',
    address: "Carrer dels Almogàvers 122, 08018 Barcelona",
    ubication: 'https://goo.gl/maps/6f9dJ2LxKp92',
    email: 'info@salarazzmatazz.com',
    phone: '+34 933 208 200',
  },
  {
    name: 'Sala Custom',
    address: 'Calle Girona 181, 08037 Barcelona',
    ubication: 'https://www.google.com/maps/place/Sala+Custom',
    email: 'reservas@salacustom.com',
    phone: '+34 932 461 741',
  },
  {
    name: 'Fabrik Valencia',
    address: 'Carretera de Real de Montroi, s/n, 46370 Chiva',
    ubication: 'https://goo.gl/maps/f6ZqW3dRt7L2',
    email: 'info@fabrikclub.com',
    phone: '+34 962 526 469',
  },
];

async function upsertPlace(seedPlace: SeedPlace) {
  const existing = await prisma.place.findUnique({
    where: { name: seedPlace.name },
  });

  if (existing) {
    return prisma.place.update({
      where: { name: seedPlace.name },
      data: {
        address: seedPlace.address,
        ubication: seedPlace.ubication,
        email: seedPlace.email.toLowerCase(),
        phone: seedPlace.phone,
      },
    });
  }

  return prisma.$transaction(async (tx) => {
    const entity = await tx.entity.create({ data: { type: 'place' } });
    return tx.place.create({
      data: {
        id: entity.id,
        name: seedPlace.name,
        address: seedPlace.address,
        ubication: seedPlace.ubication,
        email: seedPlace.email.toLowerCase(),
        phone: seedPlace.phone,
        status: 'activo',
      },
    });
  });
}

interface SeedEvent {
  name: string;
  clientEmail: string;
  placeName: string;
  dateStart: Date;
  dateEnd: Date;
  typeEvent: string;
}

// Dates are staggered per place so that no two events on the same place
// overlap (half-open range [dateStart, dateEnd)). All dates fall within
// 2026-08-01 .. 2026-12-31, ahead of the seed run date (2026-07-17).
const events: SeedEvent[] = [
  {
    name: 'Boda Fernandez-Lopez',
    clientEmail: 'info@fernandezasociados.com.ar',
    placeName: 'Sala Apolo',
    dateStart: new Date('2026-08-01T18:00:00Z'),
    dateEnd: new Date('2026-08-01T23:59:00Z'),
    typeEvent: 'boda',
  },
  {
    name: 'Presentacion corporativa Panaderia El Amanecer',
    clientEmail: 'contacto@elamanecer.com.ar',
    placeName: 'La Riviera',
    dateStart: new Date('2026-09-05T10:00:00Z'),
    dateEnd: new Date('2026-09-05T14:00:00Z'),
    typeEvent: 'corporativo',
  },
  {
    name: 'Concierto benefico Distribuidora Norte',
    clientEmail: 'ventas@distribuidoranorte.com.ar',
    // Same place as the "Boda Fernandez-Lopez" event above, but on a
    // different day, so the two never overlap.
    placeName: 'Sala Apolo',
    dateStart: new Date('2026-08-15T20:00:00Z'),
    dateEnd: new Date('2026-08-16T02:00:00Z'),
    typeEvent: 'concierto',
  },
  {
    name: 'Conferencia legal Fernandez y Asociados',
    clientEmail: 'info@fernandezasociados.com.ar',
    placeName: 'Razzmatazz',
    dateStart: new Date('2026-10-10T09:00:00Z'),
    dateEnd: new Date('2026-10-10T18:00:00Z'),
    typeEvent: 'conferencia',
  },
  {
    name: 'Cumpleanos 50 aniversario Panaderia El Amanecer',
    clientEmail: 'contacto@elamanecer.com.ar',
    placeName: 'Sala Custom',
    dateStart: new Date('2026-11-20T19:00:00Z'),
    dateEnd: new Date('2026-11-21T01:00:00Z'),
    typeEvent: 'cumpleanos',
  },
];

async function upsertEvent(seedEvent: SeedEvent) {
  const existing = await prisma.event.findFirst({
    where: { name: seedEvent.name, dateStart: seedEvent.dateStart },
  });

  if (existing) {
    return existing;
  }

  const client = await prisma.client.findUnique({
    where: { email: seedEvent.clientEmail.toLowerCase() },
  });
  if (!client) {
    throw new Error(
      `Seed event "${seedEvent.name}" references unknown client email: ${seedEvent.clientEmail}`,
    );
  }

  const place = await prisma.place.findUnique({
    where: { name: seedEvent.placeName },
  });
  if (!place) {
    throw new Error(
      `Seed event "${seedEvent.name}" references unknown place name: ${seedEvent.placeName}`,
    );
  }

  // Entity + Event pair created atomically, one transaction per event,
  // mirroring upsertClient/upsertPlace above.
  return prisma.$transaction(async (tx) => {
    const entity = await tx.entity.create({ data: { type: 'event' } });
    return tx.event.create({
      data: {
        id: entity.id,
        name: seedEvent.name,
        clientId: client.id,
        placeId: place.id,
        dateStart: seedEvent.dateStart,
        dateEnd: seedEvent.dateEnd,
        typeEvent: seedEvent.typeEvent,
        status: 'activo',
      },
    });
  });
}

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.warn('Seed skipped: NODE_ENV=production');
    return;
  }

  for (const seedClient of clients) {
    const result = await upsertClient(seedClient);
    console.log(`Seeded client: ${result.name} (id=${result.id})`);
  }

  for (const seedPlace of places) {
    const result = await upsertPlace(seedPlace);
    console.log(`Seeded place: ${result.name} (id=${result.id})`);
  }

  for (const seedEvent of events) {
    const result = await upsertEvent(seedEvent);
    console.log(`Seeded event: ${result.name} (id=${result.id})`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
