import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger, BadRequestException } from '@nestjs/common';
import { AppModule } from './app.module';
import helmet from 'helmet';
import compression from 'compression';
import { ConfigService } from '@nestjs/config';
import { raw } from 'body-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3001);

  // ✅ Get CORS origins from environment
  const corsOriginString = configService.get<string>(
    'CORS_ORIGIN',
    'https://e-movers.vercel.app',
  );

  // Parse comma-separated origins
  const corsOrigins = corsOriginString
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  console.log('🌐 Allowed CORS Origins:', corsOrigins); // Debug log

  // Global pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      disableErrorMessages: process.env.NODE_ENV === 'production',
      exceptionFactory: (errors) => {
        const formattedErrors = errors.reduce((acc, error) => {
          acc[error.property] = Object.values(error.constraints || {}).join(
            ', ',
          );
          return acc;
        }, {});
        return new BadRequestException({ message: formattedErrors });
      },
    }),
  );

  // Middleware
  app.use(
    helmet({
      crossOriginEmbedderPolicy: false,
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
        },
      },
    }),
  );

  app.use(compression());

  // ✅ ENHANCED CORS - This is the important part
  app.enableCors({
    origin: function (origin, callback) {
      // Allow requests with no origin (mobile apps, Postman, curl)
      if (!origin) {
        console.log('✅ Allowing request with no origin');
        return callback(null, true);
      }

      // Check if origin is in allowed list
      if (corsOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.log('❌ Blocking origin:', origin);
        console.log('Allowed origins:', corsOrigins);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin',
      // Stripe sends the signature in this header. Include it so CORS preflight
      // doesn't block webhook requests from external sources (if applicable).
      'Stripe-Signature',
      'stripe-signature',
    ],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    maxAge: 3600,
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  // Start server
  await app.listen(port, '0.0.0.0');

  Logger.log(
    `🚀 Application is running on: http://localhost:${port}`,
    'Bootstrap',
  );
  Logger.log(
    `📚 API Documentation: http://localhost:${port}/api/docs`,
    'Bootstrap',
  );
  Logger.log(`🌐 CORS enabled for: ${corsOrigins.join(', ')}`, 'Bootstrap');
}

bootstrap().catch((error) => {
  Logger.error('❌ Error starting application', error, 'Bootstrap');
  process.exit(1);
});
