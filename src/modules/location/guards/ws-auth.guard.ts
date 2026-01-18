import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { FirebaseAdminService } from '../../auth/firebase-admin.service.js';

interface AuthenticatedSocket extends Socket {
  user?: {
    uid: string;
    email?: string;
  };
}

@Injectable()
export class WsAuthGuard implements CanActivate {
  private readonly logger = new Logger(WsAuthGuard.name);

  constructor(private readonly firebaseAdmin: FirebaseAdminService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client = context.switchToWs().getClient<AuthenticatedSocket>();

    // If already authenticated, allow
    if (client.user) {
      return true;
    }

    // Get token from handshake auth or query
    const authToken = client.handshake.auth?.token as string | undefined;
    const queryToken = client.handshake.query?.token as string | undefined;
    const token = authToken ?? queryToken;

    if (!token) {
      throw new WsException('No authentication token provided');
    }

    try {
      const decodedToken = await this.firebaseAdmin.verifyIdToken(token);

      // Attach user to socket for subsequent requests
      client.user = {
        uid: decodedToken.uid,
        email: decodedToken.email,
      };

      return true;
    } catch (error) {
      this.logger.warn(`WebSocket auth failed: ${(error as Error).message}`);
      throw new WsException('Invalid or expired token');
    }
  }
}
