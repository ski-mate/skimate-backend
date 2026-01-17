import { Injectable, Logger, Inject, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Redis from 'ioredis';
import center from '@turf/center';
import { points } from '@turf/helpers';
import type { Feature, Point, GeoJsonProperties } from 'geojson';
import { REDIS_CLIENT } from '../../common/redis/index.js';
import { Group } from './entities/group.entity.js';
import { User } from '../users/entities/user.entity.js';

export interface MidpointResult {
  latitude: number;
  longitude: number;
  participantCount: number;
}

@Injectable()
export class GroupService {
  private readonly logger = new Logger(GroupService.name);

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @InjectRepository(Group)
    private readonly groupRepository: Repository<Group>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * Create a new group
   */
  async createGroup(
    creatorId: string,
    name: string,
    memberIds: string[],
    description?: string,
  ): Promise<Group> {
    // Ensure creator is included in members
    const allMemberIds = [...new Set([creatorId, ...memberIds])];

    // Fetch all member users
    const members = await this.userRepository.findByIds(allMemberIds);

    if (members.length !== allMemberIds.length) {
      throw new NotFoundException('One or more users not found');
    }

    const group = this.groupRepository.create({
      name,
      description,
      createdBy: creatorId,
      members,
    });

    await this.groupRepository.save(group);
    this.logger.log(`Group ${group.id} created by ${creatorId}`);

    return group;
  }

  /**
   * Get group by ID with members
   */
  async getGroup(groupId: string): Promise<Group> {
    const group = await this.groupRepository.findOne({
      where: { id: groupId },
      relations: ['members', 'creator'],
    });

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    return group;
  }

  /**
   * Get all groups for a user
   */
  async getUserGroups(userId: string): Promise<Group[]> {
    return this.groupRepository
      .createQueryBuilder('group')
      .innerJoin('group.members', 'member')
      .leftJoinAndSelect('group.members', 'allMembers')
      .where('member.id = :userId', { userId })
      .orderBy('group.createdAt', 'DESC')
      .getMany();
  }

  /**
   * Add members to a group
   */
  async addMembers(
    groupId: string,
    requesterId: string,
    memberIds: string[],
  ): Promise<Group> {
    const group = await this.getGroup(groupId);

    // Only creator or existing members can add new members
    const isMember = group.members?.some((m) => m.id === requesterId);
    if (!isMember) {
      throw new ForbiddenException('Only group members can add new members');
    }

    const newMembers = await this.userRepository.findByIds(memberIds);

    if (newMembers.length !== memberIds.length) {
      throw new NotFoundException('One or more users not found');
    }

    // Add new members (avoid duplicates)
    const existingIds = new Set(group.members?.map((m) => m.id) ?? []);
    const membersToAdd = newMembers.filter((m) => !existingIds.has(m.id));

    if (membersToAdd.length > 0) {
      group.members = [...(group.members ?? []), ...membersToAdd];
      await this.groupRepository.save(group);
    }

    return group;
  }

  /**
   * Remove a member from a group
   */
  async removeMember(
    groupId: string,
    requesterId: string,
    memberId: string,
  ): Promise<Group> {
    const group = await this.getGroup(groupId);

    // Only creator can remove others, or member can remove themselves
    if (requesterId !== group.createdBy && requesterId !== memberId) {
      throw new ForbiddenException('Only the creator can remove members');
    }

    // Cannot remove the creator
    if (memberId === group.createdBy && requesterId !== memberId) {
      throw new ForbiddenException('Cannot remove the group creator');
    }

    group.members = group.members?.filter((m) => m.id !== memberId) ?? [];
    await this.groupRepository.save(group);

    return group;
  }

  /**
   * Calculate the geographic midpoint (centroid) for a meet-up
   * Uses Turf.js for accurate geographic calculations
   */
  async calculateMidpoint(groupId: string): Promise<MidpointResult> {
    const group = await this.getGroup(groupId);
    const memberIds = group.members?.map((m) => m.id) ?? [];

    if (memberIds.length < 2) {
      throw new Error('Need at least 2 members to calculate midpoint');
    }

    // Get latest locations for all members from Redis
    const locations: Array<{ userId: string; lat: number; lon: number }> = [];

    for (const memberId of memberIds) {
      const position = await this.redis.geopos('geo:users', memberId);

      if (position[0]) {
        locations.push({
          userId: memberId,
          lon: parseFloat(position[0][0]),
          lat: parseFloat(position[0][1]),
        });
      }
    }

    if (locations.length < 2) {
      throw new Error('Need at least 2 members with active locations');
    }

    // Create GeoJSON points for Turf.js
    const featureCollection = points(
      locations.map((loc) => [loc.lon, loc.lat]),
    );

    // Calculate centroid
    const centroid: Feature<Point, GeoJsonProperties> = center(featureCollection);

    const [longitude, latitude] = centroid.geometry.coordinates;

    this.logger.log(
      `Calculated midpoint for group ${groupId}: [${latitude}, ${longitude}]`,
    );

    return {
      latitude,
      longitude,
      participantCount: locations.length,
    };
  }

  /**
   * Update group details
   */
  async updateGroup(
    groupId: string,
    requesterId: string,
    updates: { name?: string; description?: string },
  ): Promise<Group> {
    const group = await this.getGroup(groupId);

    if (group.createdBy !== requesterId) {
      throw new ForbiddenException('Only the creator can update the group');
    }

    if (updates.name) {
      group.name = updates.name;
    }
    if (updates.description !== undefined) {
      group.description = updates.description;
    }

    await this.groupRepository.save(group);

    return group;
  }

  /**
   * Delete a group
   */
  async deleteGroup(groupId: string, requesterId: string): Promise<void> {
    const group = await this.getGroup(groupId);

    if (group.createdBy !== requesterId) {
      throw new ForbiddenException('Only the creator can delete the group');
    }

    await this.groupRepository.remove(group);
    this.logger.log(`Group ${groupId} deleted by ${requesterId}`);
  }
}
