import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { GroupService } from './group.service.js';
import { Group } from './entities/group.entity.js';
import { User } from '../users/entities/user.entity.js';
import { REDIS_CLIENT } from '../../common/redis/index.js';

describe('GroupService', () => {
  let service: GroupService;
  let groupRepository: Repository<Group>;
  let userRepository: Repository<User>;

  const mockRedis = {
    geopos: jest.fn().mockResolvedValue([]),
  };

  const mockGroupRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockUserRepository = {
    findByIds: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GroupService,
        {
          provide: REDIS_CLIENT,
          useValue: mockRedis,
        },
        {
          provide: getRepositoryToken(Group),
          useValue: mockGroupRepository,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
      ],
    }).compile();

    service = module.get<GroupService>(GroupService);
    groupRepository = module.get<Repository<Group>>(getRepositoryToken(Group));
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
  });

  describe('createGroup', () => {
    it('should create a new group with members', async () => {
      const mockUsers = [
        { id: 'user-1', fullName: 'User One' },
        { id: 'user-2', fullName: 'User Two' },
      ];

      const mockGroup = {
        id: 'group-123',
        name: 'Ski Squad',
        createdBy: 'user-1',
        members: mockUsers,
      };

      mockUserRepository.findByIds.mockResolvedValue(mockUsers);
      mockGroupRepository.create.mockReturnValue(mockGroup);
      mockGroupRepository.save.mockResolvedValue(mockGroup);

      const result = await service.createGroup(
        'user-1',
        'Ski Squad',
        ['user-2'],
        'A group for skiing',
      );

      expect(mockUserRepository.findByIds).toHaveBeenCalled();
      expect(mockGroupRepository.create).toHaveBeenCalledWith({
        name: 'Ski Squad',
        description: 'A group for skiing',
        createdBy: 'user-1',
        members: mockUsers,
      });
      expect(result.name).toBe('Ski Squad');
    });

    it('should throw NotFoundException if some users not found', async () => {
      mockUserRepository.findByIds.mockResolvedValue([
        { id: 'user-1', fullName: 'User One' },
      ]);

      await expect(
        service.createGroup('user-1', 'Ski Squad', ['user-2', 'user-3']),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getGroup', () => {
    it('should return group with members', async () => {
      const mockGroup = {
        id: 'group-123',
        name: 'Ski Squad',
        members: [{ id: 'user-1' }, { id: 'user-2' }],
      };

      mockGroupRepository.findOne.mockResolvedValue(mockGroup);

      const result = await service.getGroup('group-123');

      expect(mockGroupRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'group-123' },
        relations: ['members', 'creator'],
      });
      expect(result.name).toBe('Ski Squad');
    });

    it('should throw NotFoundException if group not found', async () => {
      mockGroupRepository.findOne.mockResolvedValue(null);

      await expect(service.getGroup('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('addMembers', () => {
    it('should add new members to group', async () => {
      const existingGroup = {
        id: 'group-123',
        name: 'Ski Squad',
        createdBy: 'user-1',
        members: [{ id: 'user-1', fullName: 'User One' }],
      };

      const newUser = { id: 'user-2', fullName: 'User Two' };

      mockGroupRepository.findOne.mockResolvedValue(existingGroup);
      mockUserRepository.findByIds.mockResolvedValue([newUser]);
      mockGroupRepository.save.mockResolvedValue({
        ...existingGroup,
        members: [...existingGroup.members, newUser],
      });

      const result = await service.addMembers('group-123', 'user-1', ['user-2']);

      expect(result.members).toHaveLength(2);
    });

    it('should throw ForbiddenException if requester not in group', async () => {
      mockGroupRepository.findOne.mockResolvedValue({
        id: 'group-123',
        members: [{ id: 'user-1' }],
      });

      await expect(
        service.addMembers('group-123', 'user-99', ['user-2']),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should not add duplicate members', async () => {
      const existingGroup = {
        id: 'group-123',
        members: [
          { id: 'user-1', fullName: 'User One' },
          { id: 'user-2', fullName: 'User Two' },
        ],
      };

      mockGroupRepository.findOne.mockResolvedValue(existingGroup);
      mockUserRepository.findByIds.mockResolvedValue([
        { id: 'user-2', fullName: 'User Two' },
      ]);
      mockGroupRepository.save.mockResolvedValue(existingGroup);

      const result = await service.addMembers('group-123', 'user-1', ['user-2']);

      expect(result.members).toHaveLength(2);
    });
  });

  describe('removeMember', () => {
    it('should allow creator to remove members', async () => {
      const existingGroup = {
        id: 'group-123',
        createdBy: 'user-1',
        members: [
          { id: 'user-1', fullName: 'User One' },
          { id: 'user-2', fullName: 'User Two' },
        ],
      };

      mockGroupRepository.findOne.mockResolvedValue(existingGroup);
      mockGroupRepository.save.mockResolvedValue({
        ...existingGroup,
        members: [{ id: 'user-1', fullName: 'User One' }],
      });

      const result = await service.removeMember('group-123', 'user-1', 'user-2');

      expect(result.members).toHaveLength(1);
    });

    it('should allow member to remove themselves', async () => {
      const existingGroup = {
        id: 'group-123',
        createdBy: 'user-1',
        members: [
          { id: 'user-1', fullName: 'User One' },
          { id: 'user-2', fullName: 'User Two' },
        ],
      };

      mockGroupRepository.findOne.mockResolvedValue(existingGroup);
      mockGroupRepository.save.mockResolvedValue({
        ...existingGroup,
        members: [{ id: 'user-1', fullName: 'User One' }],
      });

      const result = await service.removeMember('group-123', 'user-2', 'user-2');

      expect(result.members).toHaveLength(1);
    });

    it('should throw ForbiddenException if non-creator tries to remove others', async () => {
      mockGroupRepository.findOne.mockResolvedValue({
        id: 'group-123',
        createdBy: 'user-1',
        members: [{ id: 'user-1' }, { id: 'user-2' }, { id: 'user-3' }],
      });

      await expect(
        service.removeMember('group-123', 'user-2', 'user-3'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when trying to remove creator', async () => {
      mockGroupRepository.findOne.mockResolvedValue({
        id: 'group-123',
        createdBy: 'user-1',
        members: [{ id: 'user-1' }, { id: 'user-2' }],
      });

      await expect(
        service.removeMember('group-123', 'user-2', 'user-1'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('calculateMidpoint', () => {
    it('should calculate centroid from member locations', async () => {
      const mockGroup = {
        id: 'group-123',
        members: [
          { id: 'user-1' },
          { id: 'user-2' },
          { id: 'user-3' },
        ],
      };

      mockGroupRepository.findOne.mockResolvedValue(mockGroup);

      // Mock Redis geopos to return locations for all members
      mockRedis.geopos
        .mockResolvedValueOnce([['-105.9538', '39.6042']]) // user-1
        .mockResolvedValueOnce([['-105.9638', '39.6142']]) // user-2
        .mockResolvedValueOnce([['-105.9438', '39.5942']]); // user-3

      const result = await service.calculateMidpoint('group-123');

      expect(result.participantCount).toBe(3);
      expect(result.latitude).toBeDefined();
      expect(result.longitude).toBeDefined();
    });

    it('should throw error if less than 2 members have locations', async () => {
      const mockGroup = {
        id: 'group-123',
        members: [{ id: 'user-1' }, { id: 'user-2' }],
      };

      mockGroupRepository.findOne.mockResolvedValue(mockGroup);
      mockRedis.geopos
        .mockResolvedValueOnce([['-105.9538', '39.6042']])
        .mockResolvedValueOnce([null]);

      await expect(service.calculateMidpoint('group-123')).rejects.toThrow(
        'Need at least 2 members with active locations',
      );
    });

    it('should throw error if group has less than 2 members', async () => {
      mockGroupRepository.findOne.mockResolvedValue({
        id: 'group-123',
        members: [{ id: 'user-1' }],
      });

      await expect(service.calculateMidpoint('group-123')).rejects.toThrow(
        'Need at least 2 members to calculate midpoint',
      );
    });
  });

  describe('deleteGroup', () => {
    it('should allow creator to delete group', async () => {
      const mockGroup = {
        id: 'group-123',
        createdBy: 'user-1',
        members: [],
      };

      mockGroupRepository.findOne.mockResolvedValue(mockGroup);
      mockGroupRepository.remove.mockResolvedValue(mockGroup);

      await service.deleteGroup('group-123', 'user-1');

      expect(mockGroupRepository.remove).toHaveBeenCalledWith(mockGroup);
    });

    it('should throw ForbiddenException if non-creator tries to delete', async () => {
      mockGroupRepository.findOne.mockResolvedValue({
        id: 'group-123',
        createdBy: 'user-1',
        members: [],
      });

      await expect(
        service.deleteGroup('group-123', 'user-2'),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
