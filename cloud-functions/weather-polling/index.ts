/**
 * Weather Polling Cloud Function
 * Triggered by Cloud Scheduler every 15 minutes
 * Fetches weather data from Weather Unlocked API and caches in Redis
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { createClient } from 'redis';

interface ResortWeatherData {
  resortId: string;
  name: string;
  latitude: number;
  longitude: number;
}

interface WeatherUnlockedResponse {
  temp_c: number;
  feelslike_c: number;
  windspd_kmh: number;
  winddir_compass: string;
  snow_depth_cm: number;
  vis_km: number;
  wx_desc: string;
}

interface NormalizedWeather {
  temperature: number;
  feelsLike: number;
  windSpeed: number;
  windDirection: string;
  snowDepth: number;
  visibility: number;
  conditions: string;
  updatedAt: string;
}

const WEATHER_UNLOCKED_BASE_URL = 'https://api.weatherunlocked.com/api/resortforecast';
const CACHE_TTL_SECONDS = 900; // 15 minutes

// Mock resort data - in production, this would come from the database
const RESORTS: ResortWeatherData[] = [
  { resortId: 'keystone', name: 'Keystone', latitude: 39.6042, longitude: -105.9538 },
  { resortId: 'breckenridge', name: 'Breckenridge', latitude: 39.4817, longitude: -106.0384 },
  { resortId: 'vail', name: 'Vail', latitude: 39.6403, longitude: -106.3742 },
];

/**
 * Fetch weather data from Weather Unlocked API
 */
async function fetchWeatherFromAPI(
  appId: string,
  appKey: string,
  latitude: number,
  longitude: number,
): Promise<WeatherUnlockedResponse | null> {
  try {
    const url = `${WEATHER_UNLOCKED_BASE_URL}/${latitude},${longitude}?app_id=${appId}&app_key=${appKey}`;
    
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`Weather API error: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    
    // Weather Unlocked returns forecast data, we take the current conditions
    if (data.forecast && data.forecast.length > 0) {
      return data.forecast[0] as WeatherUnlockedResponse;
    }

    return null;
  } catch (error) {
    console.error(`Failed to fetch weather: ${(error as Error).message}`);
    return null;
  }
}

/**
 * Normalize weather data to our standard format
 */
function normalizeWeatherData(raw: WeatherUnlockedResponse): NormalizedWeather {
  return {
    temperature: raw.temp_c,
    feelsLike: raw.feelslike_c,
    windSpeed: raw.windspd_kmh,
    windDirection: raw.winddir_compass,
    snowDepth: raw.snow_depth_cm,
    visibility: raw.vis_km,
    conditions: raw.wx_desc,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Main Cloud Function handler
 * Runs every 15 minutes via Cloud Scheduler
 */
export const pollWeather = onSchedule(
  {
    schedule: 'every 15 minutes',
    timeZone: 'America/Denver',
    memory: '256MiB',
    timeoutSeconds: 60,
  },
  async () => {
    console.log('Starting weather polling job');

    // Get credentials from environment
    const appId = process.env.WEATHER_UNLOCKED_APP_ID;
    const appKey = process.env.WEATHER_UNLOCKED_KEY;
    const redisHost = process.env.REDIS_HOST ?? 'localhost';
    const redisPort = parseInt(process.env.REDIS_PORT ?? '6379', 10);

    if (!appId || !appKey) {
      console.error('Weather Unlocked credentials not configured');
      return;
    }

    // Connect to Redis
    const redis = createClient({
      socket: {
        host: redisHost,
        port: redisPort,
      },
    });

    try {
      await redis.connect();
      console.log(`Connected to Redis at ${redisHost}:${redisPort}`);

      // Fetch and cache weather for each resort
      const results = await Promise.allSettled(
        RESORTS.map(async (resort) => {
          console.log(`Fetching weather for ${resort.name}`);

          const weatherData = await fetchWeatherFromAPI(
            appId,
            appKey,
            resort.latitude,
            resort.longitude,
          );

          if (weatherData) {
            const normalized = normalizeWeatherData(weatherData);
            const cacheKey = `weather:${resort.resortId}`;

            await redis.setEx(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(normalized));
            console.log(`Cached weather for ${resort.name}: ${normalized.conditions}`);

            return { resort: resort.name, success: true };
          }

          return { resort: resort.name, success: false };
        }),
      );

      // Log results
      const successful = results.filter(
        (r) => r.status === 'fulfilled' && r.value.success,
      ).length;
      const failed = results.length - successful;

      console.log(`Weather polling complete: ${successful} succeeded, ${failed} failed`);
    } catch (error) {
      console.error(`Weather polling error: ${(error as Error).message}`);
    } finally {
      await redis.disconnect();
    }
  },
);
