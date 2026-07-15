import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ExpressAdapter } from '@nestjs/platform-express';
import express, { type Express } from 'express';
import type { Request, Response } from 'express';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { RequestIdInterceptor } from './common/interceptors/request-id.interceptor';
import { ConfigService } from '@nestjs/config';

let cachedApp: Express | null = null;

async function createExpressApp(): Promise<Express> {
  if (cachedApp) return cachedApp;

  const expressApp = express();
  const app = await NestFactory.create(AppModule, new ExpressAdapter(expressApp), {
    logger: ['error', 'warn', 'log'],
  });
  const config = app.get(ConfigService);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new RequestIdInterceptor());

  const origins = config.get<string[]>('frontendAllowedOrigins') ?? ['http://localhost:3000'];
  app.enableCors({
    origin: origins,
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id', 'Idempotency-Key'],
  });

  const swagger = new DocumentBuilder()
    .setTitle('Atur Gizi API')
    .setDescription('REST API v1 — Atur Gizi MVP')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swagger);
  SwaggerModule.setup('docs', app, document);
  expressApp.get('/openapi.json', (_req, res) => {
    res.json(document);
  });

  await app.init();
  cachedApp = expressApp;
  return expressApp;
}

/** Vercel serverless entry */
export default async function handler(req: Request, res: Response) {
  const server = await createExpressApp();
  return server(req, res);
}

async function bootstrapLocal() {
  const server = await createExpressApp();
  const port = parseInt(process.env.PORT ?? '4000', 10);
  server.listen(port, () => {
    console.log(`atur-gizi-api listening on ${port}`);
  });
}

if (process.env.VERCEL !== '1') {
  void bootstrapLocal();
}
