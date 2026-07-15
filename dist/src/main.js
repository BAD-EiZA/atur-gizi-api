"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const app_module_1 = require("./app.module");
const all_exceptions_filter_1 = require("./common/filters/all-exceptions.filter");
const request_id_interceptor_1 = require("./common/interceptors/request-id.interceptor");
const config_1 = require("@nestjs/config");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    const config = app.get(config_1.ConfigService);
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
    }));
    app.useGlobalFilters(new all_exceptions_filter_1.AllExceptionsFilter());
    app.useGlobalInterceptors(new request_id_interceptor_1.RequestIdInterceptor());
    const origins = config.get('frontendAllowedOrigins') ?? ['http://localhost:3000'];
    app.enableCors({
        origin: origins,
        credentials: true,
        allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id', 'Idempotency-Key'],
    });
    const swagger = new swagger_1.DocumentBuilder()
        .setTitle('Atur Gizi API')
        .setDescription('REST API v1 — Atur Gizi MVP')
        .setVersion('1.0')
        .addBearerAuth()
        .build();
    const document = swagger_1.SwaggerModule.createDocument(app, swagger);
    swagger_1.SwaggerModule.setup('docs', app, document);
    app.getHttpAdapter().get('/openapi.json', (_req, res) => {
        res.json(document);
    });
    const port = config.get('port') ?? 4000;
    await app.listen(port);
    console.log(`atur-gizi-api listening on ${port}`);
}
bootstrap();
//# sourceMappingURL=main.js.map