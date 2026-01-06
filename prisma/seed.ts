import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function hashPassword(password: string): Promise<string> {
	return bcrypt.hash(password, 10);
}

async function main() {
	console.log('Seeding database...');

	// Create rooms (matching the canonical inventory from pricing.ts)
	const rooms = [
		{ id: 1, name: 'Bedroom 1', description: 'Master bedroom with king bed and bunks' },
		{ id: 2, name: 'Bedroom 2', description: 'Queen bed with bunks' },
		{ id: 3, name: 'Bedroom 3', description: 'Queen bed with bunks' },
		{ id: 4, name: 'Bedroom 4', description: 'Queen and twin beds' },
		{ id: 5, name: 'Bedroom 5', description: 'Queen bed' },
		{ id: 6, name: 'Bedroom 6', description: 'Queen bed' },
		{ id: 7, name: 'Bedroom 7', description: 'Queen bed with bunks' },
		{ id: 8, name: 'Bedroom 8', description: 'Queen bed with bunks' },
		{ id: 9, name: 'Bedroom 9', description: 'Queen and twin beds' }
	];

	for (const room of rooms) {
		await prisma.room.upsert({
			where: { id: room.id },
			update: {},
			create: room
		});
	}

	// Create beds (matching canonical inventory)
	const beds = [
		// Bedroom 1
		{ id: 'r1-king', roomId: 1, bedType: 'king', capacity: 2 },
		{ id: 'r1-bunk-a', roomId: 1, bedType: 'bunk', capacity: 1 },
		{ id: 'r1-bunk-b', roomId: 1, bedType: 'bunk', capacity: 1 },

		// Bedroom 2
		{ id: 'r2-queen', roomId: 2, bedType: 'queen', capacity: 2 },
		{ id: 'r2-bunk-a', roomId: 2, bedType: 'bunk', capacity: 1 },
		{ id: 'r2-bunk-b', roomId: 2, bedType: 'bunk', capacity: 1 },

		// Bedroom 3
		{ id: 'r3-queen', roomId: 3, bedType: 'queen', capacity: 2 },
		{ id: 'r3-bunk-a', roomId: 3, bedType: 'bunk', capacity: 1 },
		{ id: 'r3-bunk-b', roomId: 3, bedType: 'bunk', capacity: 1 },

		// Bedroom 4
		{ id: 'r4-queen', roomId: 4, bedType: 'queen', capacity: 2 },
		{ id: 'r4-twin', roomId: 4, bedType: 'twin', capacity: 1 },

		// Bedroom 5
		{ id: 'r5-queen', roomId: 5, bedType: 'queen', capacity: 2 },

		// Bedroom 6
		{ id: 'r6-queen', roomId: 6, bedType: 'queen', capacity: 2 },

		// Bedroom 7
		{ id: 'r7-queen', roomId: 7, bedType: 'queen', capacity: 2 },
		{ id: 'r7-bunk-a', roomId: 7, bedType: 'bunk', capacity: 1 },
		{ id: 'r7-bunk-b', roomId: 7, bedType: 'bunk', capacity: 1 },

		// Bedroom 8
		{ id: 'r8-queen', roomId: 8, bedType: 'queen', capacity: 2 },
		{ id: 'r8-bunk-a', roomId: 8, bedType: 'bunk', capacity: 1 },
		{ id: 'r8-bunk-b', roomId: 8, bedType: 'bunk', capacity: 1 },

		// Bedroom 9
		{ id: 'r9-queen', roomId: 9, bedType: 'queen', capacity: 2 },
		{ id: 'r9-twin', roomId: 9, bedType: 'twin', capacity: 1 }
	];

	for (const bed of beds) {
		await prisma.bed.upsert({
			where: { id: bed.id },
			update: {},
			create: bed
		});
	}

	console.log('Rooms and beds seeded successfully!');

	// Create default admin user (change password in production!)
	const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
	const adminPassword = process.env.ADMIN_PASSWORD || 'changeme123';

	const passwordHash = await hashPassword(adminPassword);

	await prisma.adminUser.upsert({
		where: { email: adminEmail },
		update: {},
		create: {
			email: adminEmail,
			passwordHash
		}
	});

	console.log(`Admin user created: ${adminEmail}`);
	console.log('⚠️  IMPORTANT: Change the admin password in production!');
}

main()
	.catch((e) => {
		console.error('Error seeding database:', e);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});

