import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { ClassSerializerInterceptor, Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import * as compression from 'compression';
import { ConfigService } from '@nestjs/config';
import { useContainer } from 'class-validator';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TimeoutInterceptor } from './common/interceptors/timeout.interceptor';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { ValidationExceptionFilter } from './common/filters/validation-exception.filter';

const logger = new Logger('Bootstrap');

async function bootstrap() {
  // Create the application with logger
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  // Get config service
  const configService = app.get(ConfigService);
  const isProduction = configService.get('NODE_ENV') === 'production';
  const port = configService.get('PORT') || 3000;

  // Security Middleware
  app.use(helmet());
  app.use(compression());
  
  // Trust proxy if behind a reverse proxy (e.g., Nginx, Heroku, etc.)
  const trustProxy = configService.get('TRUST_PROXY', 'false').toLowerCase() === 'true';
  if (trustProxy) {
    app.set('trust proxy', 1);
  }

  // CORS Configuration
  app.enableCors({
    origin: isProduction 
      ? [
          configService.get('FRONTEND_URL'),
          `https://${configService.get('FRONTEND_URL')}`,
        ]
      : true, // Allow all in development
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Global prefix and versioning
  app.setGlobalPrefix('api/v1');
  app.enableVersioning({
    type: VersioningType.URI,
  });

  // Global pipes, filters, and interceptors
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global filters
  app.useGlobalFilters(
    new HttpExceptionFilter(),
    new ValidationExceptionFilter(),
  );

  // Global interceptors
  const reflector = app.get(Reflector);
  app.useGlobalInterceptors(
    new ClassSerializerInterceptor(reflector),
    new TransformInterceptor(),
    new TimeoutInterceptor(),
    new LoggingInterceptor(),
  );

  // Enable DI for class-validator
  useContainer(app.select(AppModule), { fallbackOnErrors: true });

  // Swagger Configuration (only in non-production)
  if (!isProduction) {
    const config = new DocumentBuilder()
      .setTitle('StarkHive API')
      .setDescription('API documentation for StarkHive')
      .setVersion('1.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          name: 'JWT',
          description: 'Enter JWT token',
          in: 'header',
        },
        'jwt-auth',
      )
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        tagsSorter: 'alpha',
        operationsSorter: 'method',
      },
    });
  }

  // Start the application
  await app.listen(port, '0.0.0.0');
  logger.log(`Application is running on: http://localhost:${port}`);
  
  if (!isProduction) {
    logger.log(`Swagger UI available at: http://localhost:${port}/api`);
  }
}

bootstrap().catch((error) => {
  logger.error('Failed to start application:', error);
  process.exit(1);
});
