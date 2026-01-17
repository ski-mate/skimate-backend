import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FirebaseAuthGuard } from './firebase-auth.guard.js';
import { FirebaseAdminService } from '../../modules/auth/firebase-admin.service.js';

describe('FirebaseAuthGuard', () => {
  let guard: FirebaseAuthGuard;
  let firebaseAdmin: FirebaseAdminService;
  let reflector: Reflector;

  const mockFirebaseAdmin = {
    verifyIdToken: jest.fn(),
  };

  const mockReflector = {
    getAllAndOverride: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FirebaseAuthGuard,
        {
          provide: FirebaseAdminService,
          useValue: mockFirebaseAdmin,
        },
        {
          provide: Reflector,
          useValue: mockReflector,
        },
      ],
    }).compile();

    guard = module.get<FirebaseAuthGuard>(FirebaseAuthGuard);
    firebaseAdmin = module.get<FirebaseAdminService>(FirebaseAdminService);
    reflector = module.get<Reflector>(Reflector);
  });

  const createMockExecutionContext = (
    authHeader?: string,
  ): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: {
            authorization: authHeader,
          },
        }),
      }),
      getHandler: () => jest.fn(),
      getClass: () => jest.fn(),
    } as unknown as ExecutionContext;
  };

  describe('canActivate', () => {
    it('should allow public routes', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(true);

      const context = createMockExecutionContext();
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockFirebaseAdmin.verifyIdToken).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when no auth header', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(false);

      const context = createMockExecutionContext();

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for invalid header format', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(false);

      const context = createMockExecutionContext('InvalidFormat');

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for non-Bearer token', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(false);

      const context = createMockExecutionContext('Basic token123');

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should verify valid Bearer token', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(false);
      mockFirebaseAdmin.verifyIdToken.mockResolvedValue({
        uid: 'user-123',
        email: 'test@example.com',
        email_verified: true,
      });

      const context = createMockExecutionContext('Bearer valid-token');
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockFirebaseAdmin.verifyIdToken).toHaveBeenCalledWith('valid-token');
    });

    it('should attach user to request on successful auth', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(false);
      mockFirebaseAdmin.verifyIdToken.mockResolvedValue({
        uid: 'user-123',
        email: 'test@example.com',
        email_verified: true,
      });

      const request: Record<string, unknown> = { headers: { authorization: 'Bearer valid-token' } };
      const context = {
        switchToHttp: () => ({
          getRequest: () => request,
        }),
        getHandler: () => jest.fn(),
        getClass: () => jest.fn(),
      } as unknown as ExecutionContext;

      await guard.canActivate(context);

      expect(request.user).toEqual({
        uid: 'user-123',
        email: 'test@example.com',
        emailVerified: true,
      });
    });

    it('should throw UnauthorizedException for expired token', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(false);
      mockFirebaseAdmin.verifyIdToken.mockRejectedValue(
        new Error('Token expired'),
      );

      const context = createMockExecutionContext('Bearer expired-token');

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
