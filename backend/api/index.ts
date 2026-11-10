import app from '../src/app';
import { checkPrismaConnection } from '../src/db';
import { seedInitialData } from '../src/prisma/seed';

let isInitialized = false;

export default async function handler(req: any, res: any) {
  if (!isInitialized) {
    await checkPrismaConnection();
    await seedInitialData();
    isInitialized = true;
  }
  return app(req, res);
}
