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

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.warn('Seed skipped: NODE_ENV=production');
    return;
  }

  for (const seedClient of clients) {
    const result = await upsertClient(seedClient);
    console.log(`Seeded client: ${result.name} (id=${result.id})`);
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
