// user-management.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { UserManagementService } from './user-management.service';
import { AddAdminDto } from './dto/add-admin.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { QueryUsersDto } from './dto/query-users.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('User Management (Admin Only)')
@ApiBearerAuth()
@Controller('admin/user-management')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class UserManagementController {
  constructor(private readonly userManagementService: UserManagementService) {}

  @Get('users')
  @ApiOperation({ summary: 'Get all users with pagination and filters' })
  async getAllUsers(@Query() query: QueryUsersDto) {
    return this.userManagementService.getAllUsers(query);
  }

  @Get('admins')
  @ApiOperation({ summary: 'Get all admins' })
  async getAllAdmins(@Query() query: QueryUsersDto) {
    return this.userManagementService.getAllAdmins(query);
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Get user by ID' })
  async getUserById(@Param('id', ParseIntPipe) id: number) {
    return this.userManagementService.getUserById(id);
  }

  @Post('admins')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add new admin' })
  async addAdmin(@Body() addAdminDto: AddAdminDto, @Request() req) {
    const currentAdmin = req.user; // { id, email, role }
    return this.userManagementService.addAdmin(addAdminDto, currentAdmin);
  }

  @Put('users/:id')
  @ApiOperation({ summary: 'Update user or admin' })
  async updateUser(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto,
    @Request() req,
  ) {
    const currentAdmin = req.user;
    return this.userManagementService.updateUser(
      id,
      updateUserDto,
      currentAdmin,
    );
  }

  @Delete('users/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete user or admin' })
  async deleteUser(@Param('id', ParseIntPipe) id: number, @Request() req) {
    const currentAdmin = req.user;
    return this.userManagementService.deleteUser(id, currentAdmin);
  }

  @Get('statistics')
  @ApiOperation({ summary: 'Get user statistics' })
  async getUserStatistics() {
    return this.userManagementService.getUserStatistics();
  }
}
