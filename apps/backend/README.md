# Levantar la DB

> Pasos:

1. Poner la cadena: **DATABASE_URL** del .env hardcoded mientras se corren migraciones en el archivo: ```apps/backend/prisma/schema.prisma``` en la linea: ***url = env("DATABASE_URL")***
2. Levantar migraciones: ```npx prisma migrate dev --schema=apps/backend/prisma/schema.prisma```
3. Datos de prueba: ```npx prisma db seed```