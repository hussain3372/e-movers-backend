import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type Range = 'daily' | 'weekly' | 'monthly' | 'yearly';

@Injectable()
export class DashboardService {
	constructor(private readonly prisma: PrismaService) {}

	async getCards() {
		try {
			const usersCount = await this.prisma.user.count({ where: { role: { not: 'ADMIN' } } });
			const totalBookings = await this.prisma.booking.count();
			const storageBookings = await this.prisma.booking.count({ where: { type: 'STORAGE' } });
			const movingBookings = await this.prisma.booking.count({ where: { type: 'MOVING' } });

			return {
				success: true,
				message: 'Cards fetched',
				data: { usersCount, totalBookings, storageBookings, movingBookings },
			};
		} catch (error: any) {
			return { success: false, message: error?.message || 'Failed to fetch cards', data: null };
		}
	}

	// Helpers to build UTC date boundaries
	private startOfDayUTC(d: Date) {
		return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
	}

	private addHours(d: Date, hours: number) {
		return new Date(d.getTime() + hours * 3600 * 1000);
	}

	private addDays(d: Date, days: number) {
		return new Date(d.getTime() + days * 24 * 3600 * 1000);
	}

	private startOfMonthUTC(d: Date) {
		return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
	}

	private addMonthsUTC(d: Date, months: number) {
		return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1));
	}

	private formatLabel(d: Date, range: Range) {
		const year = d.getUTCFullYear();
		const month = String(d.getUTCMonth() + 1).padStart(2, '0');
		const day = String(d.getUTCDate()).padStart(2, '0');
		const hour = String(d.getUTCHours()).padStart(2, '0');
		if (range === 'daily') return `${year}-${month}-${day} ${hour}:00`;
		if (range === 'weekly' || range === 'monthly') return `${year}-${month}-${day}`;
		return `${year}-${month}`;
	}

	private buildBuckets(range: Range) {
		const now = new Date();
		const buckets: Array<{ start: Date; end: Date; label: string }> = [];

		if (range === 'daily') {
			// last 24 hours divided into 6 candles (4-hour buckets)
			const end = now;
			const start = new Date(end.getTime() - 24 * 3600 * 1000);
			const bucketHours = 4;
			let cursor = new Date(start);
			while (cursor < end) {
				const next = this.addHours(cursor, bucketHours);
				buckets.push({ start: new Date(cursor), end: next > end ? end : next, label: this.formatLabel(cursor, 'daily') });
				cursor = next;
			}
			// ensure exactly 6 buckets
			if (buckets.length > 6) buckets.splice(6);
			while (buckets.length < 6) {
				const last = buckets[buckets.length - 1];
				const s = last ? new Date(last.end) : new Date(now.getTime() - bucketHours * 3600 * 1000);
				const e = this.addHours(s, bucketHours);
				buckets.push({ start: s, end: e > now ? now : e, label: this.formatLabel(s, 'daily') });
			}
		} else if (range === 'weekly') {
			// current 7 days (each day a bucket) ending today
			const todayStart = this.startOfDayUTC(now);
			for (let i = 6; i >= 0; i--) {
				const dayStart = this.addDays(todayStart, -i);
				const dayEnd = this.addDays(dayStart, 1);
				buckets.push({ start: dayStart, end: dayEnd > now ? now : dayEnd, label: this.formatLabel(dayStart, 'weekly') });
			}
		} else if (range === 'monthly') {
			// 4 weeks of the current month starting from month start
			const monthStart = this.startOfMonthUTC(now);
			for (let i = 0; i < 4; i++) {
				const s = this.addDays(monthStart, i * 7);
				const e = this.addDays(s, 7);
				// do not include future ranges beyond now
				if (s >= now) break;
				buckets.push({ start: s, end: e > now ? now : e, label: this.formatLabel(s, 'monthly') });
			}
			// Ensure exactly 4 buckets (fill with zeros if needed)
			while (buckets.length < 4) {
				const lastEnd = buckets.length ? buckets[buckets.length - 1].end : monthStart;
				const s = new Date(lastEnd);
				const e = this.addDays(s, 7);
				if (s >= now) break;
				buckets.push({ start: s, end: e > now ? now : e, label: this.formatLabel(s, 'monthly') });
			}
		} else {
			// yearly: last 12 months (each bucket is a month)
			// include only up to current month and previous 11 months
			const currentMonthStart = this.startOfMonthUTC(now);
			for (let i = 11; i >= 0; i--) {
				const s = this.addMonthsUTC(currentMonthStart, -i);
				const e = this.addMonthsUTC(s, 1);
				buckets.push({ start: s, end: e > now ? now : e, label: this.formatLabel(s, 'yearly') });
			}
		}

		return buckets;
	}

	async getUsersGraph(rangeParam?: string) {
		const range = (rangeParam || 'daily') as Range;
		try {
			const buckets = this.buildBuckets(range);
			const results: Array<{ period: string; count: number }> = [];
			for (const b of buckets) {
				const count = await this.prisma.user.count({
					where: {
						role: { not: 'ADMIN' },
						createdAt: { gte: b.start, lt: b.end },
					},
				});
				results.push({ period: b.label, count: count ?? 0 });
			}

			return { success: true, message: 'Users graph fetched', data: results };
		} catch (error: any) {
			return { success: false, message: error?.message || 'Failed to fetch users graph', data: null };
		}
	}

	async getBookingsGraph(rangeParam?: string) {
		const range = (rangeParam || 'daily') as Range;
		try {
			const buckets = this.buildBuckets(range);
			const results: Array<{ period: string; moving: number; storage: number }> = [];
			for (const b of buckets) {
				const moving = await this.prisma.booking.count({ where: { type: 'MOVING', createdAt: { gte: b.start, lt: b.end } } });
				const storage = await this.prisma.booking.count({ where: { type: 'STORAGE', createdAt: { gte: b.start, lt: b.end } } });
				results.push({ period: b.label, moving: moving ?? 0, storage: storage ?? 0 });
			}

			return { success: true, message: 'Bookings graph fetched', data: results };
		} catch (error: any) {
			return { success: false, message: error?.message || 'Failed to fetch bookings graph', data: null };
		}
	}
}
