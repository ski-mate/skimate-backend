export interface DatabaseConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  name: string;
}

export interface RedisConfig {
  host: string;
  port: number;
  password: string;
}

export interface FirebaseConfig {
  projectId: string;
}

export interface WeatherUnlockedConfig {
  appId: string;
  key: string;
}

export interface StravaConfig {
  clientId: string;
  clientSecret: string;
  accessToken: string;
  refreshToken: string;
  verifyToken: string;
}

export interface MapboxConfig {
  publicToken: string;
  secretToken: string;
}

export interface AppConfig {
  nodeEnv: string;
  port: number;
  database: DatabaseConfig;
  redis: RedisConfig;
  firebase: FirebaseConfig;
  weatherUnlocked: WeatherUnlockedConfig;
  strava: StravaConfig;
  mapbox: MapboxConfig;
  gcpProjectId: string;
}

export default (): AppConfig => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  database: {
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    username: process.env.DB_USERNAME ?? 'postgres',
    password: process.env.DB_PASSWORD ?? '',
    name: process.env.DB_NAME ?? 'skimate',
  },
  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
    password: process.env.REDIS_PASSWORD ?? '',
  },
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID ?? 'skimate-307c2',
  },
  weatherUnlocked: {
    appId: process.env.WEATHER_UNLOCKED_APP_ID ?? '',
    key: process.env.WEATHER_UNLOCKED_KEY ?? '',
  },
  strava: {
    clientId: process.env.STRAVA_CLIENT_ID ?? '',
    clientSecret: process.env.STRAVA_CLIENT_SECRET ?? '',
    accessToken: process.env.STRAVA_ACCESS_TOKEN ?? '',
    refreshToken: process.env.STRAVA_REFRESH_TOKEN ?? '',
    verifyToken: process.env.STRAVA_VERIFY_TOKEN ?? '',
  },
  mapbox: {
    publicToken: process.env.MAPBOX_PUBLIC_TOKEN ?? '',
    secretToken: process.env.MAPBOX_SECRET_TOKEN ?? '',
  },
  gcpProjectId: process.env.GCP_PROJECT_ID ?? 'skimate',
});
