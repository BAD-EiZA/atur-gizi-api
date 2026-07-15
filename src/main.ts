import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { RequestIdInterceptor } from './common/interceptors/request-id.interceptor';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
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
  app.getHttpAdapter().get('/openapi.json', (_req: unknown, res: { json: (b: unknown) => void }) => {
    res.json(document);
  });

  const port = Number(process.env.PORT ?? config.get<number>('port') ?? 4000);
  await app.listen(port);
  console.log(`atur-gizi-api listening on ${port}`);
}

bootstrap();
