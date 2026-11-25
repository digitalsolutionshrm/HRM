import 'dotenv/config';
import { DataSource } from 'typeorm';
import { getPostgresConnectionOptions } from './src/database/postgres-options';

export default new DataSource({
  ...getPostgresConnectionOptions(),

  entities: [
    'src/**/*.entity.ts',
  ],

  migrations: [
    'src/database/migrations/*.ts',
  ],
});