import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { FirebaseAdminService } from './firebase-admin.service.js';

// Mock firebase-admin
jest.mock('firebase-admin', () => ({
  apps: [],
  initializeApp: jest.fn().mockReturnValue({
    auth: jest.fn().mockReturnValue({
      verifyIdToken: jest.fn(),
      getUser: jest.fn(),
    }),
  }),
}));

describe('FirebaseAdminService', () => {
  let service: FirebaseAdminService;
  let _configService: ConfigService;

  const mockConfigService = {
    get: jest.fn().mockReturnValue('skimate-307c2'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FirebaseAdminService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<FirebaseAdminService>(FirebaseAdminService);
    _configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('onModuleInit', () => {
    it('should initialize Firebase Admin SDK', () => {
      service.onModuleInit();
      expect(mockConfigService.get).toHaveBeenCalledWith('firebase.projectId', {
        infer: true,
      });
    });
  });

  describe('verifyIdToken', () => {
    it('should verify a valid token', async () => {
      const mockDecodedToken = {
        uid: 'test-user-id',
        email: 'test@example.com',
        email_verified: true,
      };

      service.onModuleInit();
      const auth = service.getAuth();
      (auth.verifyIdToken as jest.Mock).mockResolvedValue(mockDecodedToken);

      const result = await service.verifyIdToken('valid-token');

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(auth.verifyIdToken).toHaveBeenCalledWith('valid-token');
      expect(result).toEqual(mockDecodedToken);
    });

    it('should throw error for invalid token', async () => {
      service.onModuleInit();
      const auth = service.getAuth();
      (auth.verifyIdToken as jest.Mock).mockRejectedValue(
        new Error('Invalid token'),
      );

      await expect(service.verifyIdToken('invalid-token')).rejects.toThrow(
        'Invalid token',
      );
    });
  });

  describe('getUser', () => {
    it('should get user by UID', async () => {
      const mockUser = {
        uid: 'test-user-id',
        email: 'test@example.com',
        displayName: 'Test User',
      };

      service.onModuleInit();
      const auth = service.getAuth();
      (auth.getUser as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.getUser('test-user-id');

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(auth.getUser).toHaveBeenCalledWith('test-user-id');
      expect(result).toEqual(mockUser);
    });
  });
});
