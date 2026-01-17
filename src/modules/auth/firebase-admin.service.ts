import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import type { AppConfig } from '../../config/configuration.js';

@Injectable()
export class FirebaseAdminService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseAdminService.name);
  private app: admin.app.App | null = null;

  constructor(private readonly configService: ConfigService<AppConfig, true>) {}

  onModuleInit(): void {
    const projectId = this.configService.get('firebase.projectId', { infer: true });

    if (admin.apps.length === 0) {
      this.app = admin.initializeApp({
        projectId,
      });
      this.logger.log(`Firebase Admin initialized for project: ${projectId}`);
    } else {
      this.app = admin.apps[0] ?? null;
      this.logger.log('Firebase Admin already initialized');
    }
  }

  getAuth(): admin.auth.Auth {
    if (!this.app) {
      throw new Error('Firebase Admin not initialized');
    }
    return this.app.auth();
  }

  async verifyIdToken(idToken: string): Promise<admin.auth.DecodedIdToken> {
    return this.getAuth().verifyIdToken(idToken);
  }

  async getUser(uid: string): Promise<admin.auth.UserRecord> {
    return this.getAuth().getUser(uid);
  }
}
