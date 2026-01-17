import { IsEnum, IsNumber, IsOptional, IsString, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';

export enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

export class EnvironmentVariables {
  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV: Environment = Environment.Development;

  @Transform(({ value }: { value: string }) => parseInt(value, 10))
  @IsNumber()
  @Min(1)
  @Max(65535)
  @IsOptional()
  PORT = 3000;

  @IsString()
  FIREBASE_PROJECT_ID!: string;

  @IsString()
  DB_HOST!: string;

  @Transform(({ value }: { value: string }) => parseInt(value, 10))
  @IsNumber()
  @IsOptional()
  DB_PORT = 5432;

  @IsString()
  DB_USERNAME!: string;

  @IsString()
  DB_PASSWORD!: string;

  @IsString()
  DB_NAME!: string;

  @IsString()
  REDIS_HOST!: string;

  @Transform(({ value }: { value: string }) => parseInt(value, 10))
  @IsNumber()
  @IsOptional()
  REDIS_PORT = 6379;

  @IsString()
  @IsOptional()
  REDIS_PASSWORD = '';

  @IsString()
  @IsOptional()
  WEATHER_UNLOCKED_APP_ID = '';

  @IsString()
  @IsOptional()
  WEATHER_UNLOCKED_KEY = '';

  @IsString()
  @IsOptional()
  STRAVA_CLIENT_ID = '';

  @IsString()
  @IsOptional()
  STRAVA_CLIENT_SECRET = '';

  @IsString()
  @IsOptional()
  STRAVA_ACCESS_TOKEN = '';

  @IsString()
  @IsOptional()
  STRAVA_REFRESH_TOKEN = '';

  @IsString()
  @IsOptional()
  STRAVA_VERIFY_TOKEN = '';

  @IsString()
  @IsOptional()
  MAPBOX_PUBLIC_TOKEN = '';

  @IsString()
  @IsOptional()
  MAPBOX_SECRET_TOKEN = '';

  @IsString()
  @IsOptional()
  GCP_PROJECT_ID = 'skimate';
}
