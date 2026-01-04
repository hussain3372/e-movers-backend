// user-management.service.ts
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  Logger,
  Inject,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UserRole, UserStatus } from '@prisma/client';
import { AddAdminDto } from './dto/add-admin.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { QueryUsersDto } from './dto/query-users.dto';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '@/common/mail/mail.service';

@Injectable()
export class UserManagementService {
  private readonly logger = new Logger(UserManagementService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  async getAllUsers(query: QueryUsersDto) {
    const { page = 1, limit = 10, role, status, search } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      role: UserRole.USER, // Only regular users
    };

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          name: true,
          firstName: true,
          lastName: true,
          phone: true,
          role: true,
          status: true,
          emailVerified: true,
          mfaEnabled: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
          profilePicture: true,
          isEmail: true,
          isNotification: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      success: true,
      message: 'Users retrieved successfully',
      data: users,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getAllAdmins(query: QueryUsersDto) {
    const { page = 1, limit = 10, status, search } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      role: UserRole.ADMIN, // Only admins
    };

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [admins, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          name: true,
          firstName: true,
          lastName: true,
          phone: true,
          role: true,
          status: true,
          emailVerified: true,
          mfaEnabled: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
          profilePicture: true,
          isEmail: true,
          isNotification: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      success: true,
      message: 'Admins retrieved successfully',
      data: admins,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getUserById(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        status: true,
        emailVerified: true,
        mfaEnabled: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        profilePicture: true,
        googleId: true,
        isEmail: true,
        isNotification: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

    async addAdmin(addAdminDto: AddAdminDto, currentAdmin: any) {
      // Check if email already exists
      const existingUser = await this.prisma.user.findUnique({
        where: { email: addAdminDto.email.toLowerCase() },
      });

      if (existingUser) {
        throw new ConflictException('User with this email already exists');
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(addAdminDto.password, 12);

      // Create admin user
      const newAdmin = await this.prisma.user.create({
        data: {
          email: addAdminDto.email.toLowerCase(),
          password: hashedPassword,
          firstName: addAdminDto.firstName,
          lastName: addAdminDto.lastName,
          name: `${addAdminDto.firstName} ${addAdminDto.lastName}`.trim(),
          phone: addAdminDto.phone,
          role: UserRole.ADMIN,
          status: UserStatus.ACTIVE,
          emailVerified: true, // Admin accounts are pre-verified
        },
      });

      // Get all other admins to notify them
      const allAdmins = await this.prisma.user.findMany({
        where: {
          role: UserRole.ADMIN,
          id: { not: newAdmin.id },
          isEmail: true,
        },
        select: {
          email: true,
          firstName: true,
          name: true,
        },
      });

      // Send welcome email to new admin
      await this.mailService.sendAdminWelcomeEmail(
        newAdmin.email,
        addAdminDto.firstName,
        addAdminDto.password, // Send temp password
      );

      // Notify all other admins about new admin
      const notificationPromises = allAdmins.map((admin) =>
        this.mailService.sendNewAdminNotificationEmail(
          admin.email,
          admin.firstName || admin.name,
          {
            name: newAdmin.name,
            email: newAdmin.email,
            addedBy: currentAdmin.email,
          },
        ),
      );

      await Promise.all(notificationPromises);

      this.logger.log(
        `New admin created: ${newAdmin.email} by ${currentAdmin.email}`,
        'UserManagementService',
      );

      return {
        status: 'success',
        message: 'Admin created successfully and notifications sent',
        admin: {
          id: newAdmin.id,
          email: newAdmin.email,
          name: newAdmin.name,
          firstName: newAdmin.firstName,
          lastName: newAdmin.lastName,
          role: newAdmin.role,
        },
      };
    }

  async updateUser(
    id: number,
    updateUserDto: UpdateUserDto,
    currentAdmin: any,
  ) {
    // Check if user exists
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Prevent admin from demoting themselves
    if (
      user.id === currentAdmin.id &&
      updateUserDto.role &&
      updateUserDto.role !== UserRole.ADMIN
    ) {
      throw new ForbiddenException('You cannot change your own admin role');
    }

    // Build update data
    const updateData: any = {};

    if (updateUserDto.firstName) updateData.firstName = updateUserDto.firstName;
    if (updateUserDto.lastName) updateData.lastName = updateUserDto.lastName;
    if (updateUserDto.phone) updateData.phone = updateUserDto.phone;
    if (updateUserDto.role) updateData.role = updateUserDto.role;
    if (updateUserDto.status) updateData.status = updateUserDto.status;
    if (updateUserDto.emailVerified !== undefined)
      updateData.emailVerified = updateUserDto.emailVerified;
    if (updateUserDto.isEmail !== undefined)
      updateData.isEmail = updateUserDto.isEmail;
    if (updateUserDto.isNotification !== undefined)
      updateData.isNotification = updateUserDto.isNotification;
    if (updateUserDto.mfaEnabled !== undefined)
      updateData.mfaEnabled = updateUserDto.mfaEnabled;

    // Update name if firstName or lastName changed
    if (updateUserDto.firstName || updateUserDto.lastName) {
      updateData.name = `${updateUserDto.firstName || user.firstName} ${
        updateUserDto.lastName || user.lastName
      }`.trim();
    }

    updateData.updatedAt = new Date();

    // Update user
    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        status: true,
        emailVerified: true,
        mfaEnabled: true,
        isEmail: true,
        isNotification: true,
        updatedAt: true,
      },
    });

    this.logger.log(
      `User ${updatedUser.email} updated by admin ${currentAdmin.email}`,
      'UserManagementService',
    );

    return {
      status: 'success',
      message: 'User updated successfully',
      user: updatedUser,
    };
  }

  async deleteUser(id: number, currentAdmin: any) {
    // Check if user exists
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Prevent admin from deleting themselves
    if (user.id === currentAdmin.id) {
      throw new ForbiddenException('You cannot delete your own account');
    }

    // If deleting an admin, notify all other admins
    if (user.role === UserRole.ADMIN) {
      const allAdmins = await this.prisma.user.findMany({
        where: {
          role: UserRole.ADMIN,
          id: { not: id },
          isEmail: true,
        },
        select: {
          email: true,
          firstName: true,
          name: true,
        },
      });

      const notificationPromises = allAdmins.map((admin) =>
        this.mailService.sendAdminDeletedNotificationEmail(
          admin.email,
          admin.firstName || admin.name,
          {
            name: user.name,
            email: user.email,
            deletedBy: currentAdmin.email,
          },
        ),
      );

      await Promise.all(notificationPromises);
    }

    // Delete user
    await this.prisma.user.delete({
      where: { id },
    });

    this.logger.log(
      `User ${user.email} deleted by admin ${currentAdmin.email}`,
      'UserManagementService',
    );

    return {
      status: 'success',
      message: `${user.role === UserRole.ADMIN ? 'Admin' : 'User'} deleted successfully`,
    };
  }

  async getUserStatistics() {
    const [totalUsers, totalAdmins, activeUsers, pendingUsers, verifiedUsers] =
      await Promise.all([
        this.prisma.user.count({ where: { role: UserRole.USER } }),
        this.prisma.user.count({ where: { role: UserRole.ADMIN } }),
        this.prisma.user.count({
          where: { role: UserRole.USER, status: UserStatus.ACTIVE },
        }),
        this.prisma.user.count({
          where: {
            role: UserRole.USER,
            status: UserStatus.PENDING_VERIFICATION,
          },
        }),
        this.prisma.user.count({
          where: { role: UserRole.USER, emailVerified: true },
        }),
      ]);

    // Get recent users (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentUsers = await this.prisma.user.count({
      where: {
        role: UserRole.USER,
        createdAt: { gte: sevenDaysAgo },
      },
    });

    return {
      totalUsers,
      totalAdmins,
      activeUsers,
      pendingUsers,
      verifiedUsers,
      recentUsers,
    };
  }
}
