import app from './app';
import { env } from './config/env';
import { checkPrismaConnection } from './db';
import { seedInitialData } from './prisma/seed';

const PORT = env.PORT || 3000;

async function bootstrap() {
  await checkPrismaConnection();
  await seedInitialData();

  const server = app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(` ColdChain Pulse Backend API - MedSwift Logistics Ltd. `);
    console.log(`=======================================================`);
    console.log(` Server running on http://localhost:${PORT}`);
    console.log(` OpenAPI / Swagger Docs: http://localhost:${PORT}/api/docs`);
    console.log(` Health Check: http://localhost:${PORT}/health`);
    console.log(` Real-time SSE Stream: http://localhost:${PORT}/api/v1/live/stream`);
    console.log(` Environment: ${env.NODE_ENV}`);
    console.log(`=======================================================`);
  });

  return server;
}

if (process.env.NODE_ENV !== 'test') {
  bootstrap();
}

export default app;
