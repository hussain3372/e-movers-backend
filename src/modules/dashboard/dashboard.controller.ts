import { Controller, Get, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
	constructor(private readonly dashboardService: DashboardService) {}

	@Get('stats')
	async getCards() {
		return this.dashboardService.getCards();
	}

	@Get('users-graph')
	async getUsersGraph(@Query('range') range: string) {
		return this.dashboardService.getUsersGraph(range || 'daily');
	}

	@Get('bookings-graph')
	async getBookingsGraph(@Query('range') range: string) {
		return this.dashboardService.getBookingsGraph(range || 'daily');
	}
}
