// Auto-generated TypeScript interfaces from location.proto
// In production, use protobufjs to generate these from the .proto file

export interface LocationPing {
  userId: string;
  sessionId: string;
  latitude: number;
  longitude: number;
  altitude: number;
  speed: number;
  accuracy: number;
  heading?: number;
  timestamp: number;
}

export interface LocationPingBatch {
  pings: LocationPing[];
}

export interface LocationUpdate {
  userId: string;
  latitude: number;
  longitude: number;
  altitude: number;
  speed: number;
  timestamp: number;
  resortId?: string;
}

export interface ProximityAlert {
  friendId: string;
  friendName: string;
  distance: number;
  latitude: number;
  longitude: number;
  timestamp: number;
}

export interface SessionStartRequest {
  userId: string;
  resortId?: string;
}

export interface SessionStartResponse {
  sessionId: string;
  startTime: number;
}

export interface SessionEndRequest {
  sessionId: string;
}

export interface SessionSummary {
  sessionId: string;
  totalVertical: number;
  totalDistance: number;
  maxSpeed: number;
  totalRuns: number;
  durationSeconds: number;
}

// Note: For runtime Protobuf encoding/decoding, use a separate Node.js script
// or load the .proto file at runtime with protobufjs
// The import.meta syntax is not compatible with CommonJS output

import protobuf from 'protobufjs';
import { join } from 'path';

let locationProto: protobuf.Root | null = null;

export async function loadLocationProto(): Promise<protobuf.Root> {
  if (locationProto) {
    return locationProto;
  }

  // Use __dirname equivalent for ESM compatibility
  const protoPath = join(process.cwd(), 'src', 'proto', 'location.proto');
  locationProto = await protobuf.load(protoPath);
  return locationProto;
}

export async function encodeLocationPing(ping: LocationPing): Promise<Uint8Array> {
  const root = await loadLocationProto();
  const LocationPingType = root.lookupType('skimate.location.LocationPing');

  const message = LocationPingType.create({
    userId: ping.userId,
    sessionId: ping.sessionId,
    latitude: ping.latitude,
    longitude: ping.longitude,
    altitude: ping.altitude,
    speed: ping.speed,
    accuracy: ping.accuracy,
    heading: ping.heading,
    timestamp: ping.timestamp,
  });

  return LocationPingType.encode(message).finish();
}

export async function decodeLocationPing(buffer: Uint8Array): Promise<LocationPing> {
  const root = await loadLocationProto();
  const LocationPingType = root.lookupType('skimate.location.LocationPing');

  const message = LocationPingType.decode(buffer);
  const obj = LocationPingType.toObject(message, {
    longs: Number,
    defaults: true,
  }) as Record<string, unknown>;

  return {
    userId: obj.userId as string,
    sessionId: obj.sessionId as string,
    latitude: obj.latitude as number,
    longitude: obj.longitude as number,
    altitude: obj.altitude as number,
    speed: obj.speed as number,
    accuracy: obj.accuracy as number,
    heading: obj.heading as number | undefined,
    timestamp: obj.timestamp as number,
  };
}

export async function encodeLocationUpdate(update: LocationUpdate): Promise<Uint8Array> {
  const root = await loadLocationProto();
  const LocationUpdateType = root.lookupType('skimate.location.LocationUpdate');

  const message = LocationUpdateType.create({
    userId: update.userId,
    latitude: update.latitude,
    longitude: update.longitude,
    altitude: update.altitude,
    speed: update.speed,
    timestamp: update.timestamp,
    resortId: update.resortId,
  });

  return LocationUpdateType.encode(message).finish();
}

export async function decodeLocationUpdate(buffer: Uint8Array): Promise<LocationUpdate> {
  const root = await loadLocationProto();
  const LocationUpdateType = root.lookupType('skimate.location.LocationUpdate');

  const message = LocationUpdateType.decode(buffer);
  const obj = LocationUpdateType.toObject(message, {
    longs: Number,
    defaults: true,
  }) as Record<string, unknown>;

  return {
    userId: obj.userId as string,
    latitude: obj.latitude as number,
    longitude: obj.longitude as number,
    altitude: obj.altitude as number,
    speed: obj.speed as number,
    timestamp: obj.timestamp as number,
    resortId: obj.resortId as string | undefined,
  };
}
