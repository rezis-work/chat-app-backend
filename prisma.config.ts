/// <reference types="node" />
import 'dotenv/config';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL environment variable is not set');
}

export default {
  datasource: {
    url: databaseUrl,
  },
};
