import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { getPostgresConnectionOptions } from './postgres-options';
import { DEFAULT_USERS } from './database-bootstrap';

import { User } from '../users/entities/user.entity';

const dataSource = new DataSource({
  ...getPostgresConnectionOptions({
    DB_HOST: process.env.DB_HOST || 'localhost',
    DB_PORT: process.env.DB_PORT || '5432',
    DB_USERNAME: process.env.DB_USERNAME || 'postgres',
    DB_PASSWORD: process.env.DB_PASSWORD || '1234',
    DB_DATABASE: process.env.DB_DATABASE || 'hrm_db',
    DATABASE_URL: process.env.DATABASE_URL,
  }),
  entities: [User],
  synchronize: false,
});

async function seed() {
  await dataSource.initialize();

  const userRepository = dataSource.getRepository(User);

  for (const userData of DEFAULT_USERS) {
    const existingUser = await userRepository.findOne({
      where: {
        email: userData.email,
      },
    });

    if (existingUser) {
      console.log(`User already exists: ${userData.email}`);
      continue;
    }

    const hashedPassword = await bcrypt.hash(userData.password, 10);

    const user = userRepository.create({
      name: userData.name,
      email: userData.email,
      password: hashedPassword,
      role: userData.role,
      status: true,
    });

    await userRepository.save(user);

    console.log(`Created: ${userData.email} (${userData.role})`);
  }

  await dataSource.destroy();

  console.log('Seed completed successfully!');
}

seed().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});