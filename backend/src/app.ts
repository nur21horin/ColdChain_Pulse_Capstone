import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import routes from './routes';
import { errorHandler } from './middleware/errorHandler';
import swaggerDocument from './docs/swagger.json';

const app: Application = express();

// Security and utility middleware
app.use(helmet({
  contentSecurityPolicy: false // Allows Swagger UI to render properly
}));
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    service: 'ColdChain Pulse Backend API',
    client: 'MedSwift Logistics Ltd.',
    timestamp: new Date().toISOString()
  });
});

// Swagger OpenAPI documentation UI
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.get('/api/docs.json', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerDocument);
});

// Mount V1 API routes
app.use('/api/v1', routes);

// 404 Handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'NotFound',
    message: `Cannot ${req.method} ${req.originalUrl}`
  });
});

// Centralized Error Handler
app.use(errorHandler);

export default app;
