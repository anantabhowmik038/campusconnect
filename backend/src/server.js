import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// Load environment variables using an absolute path.
const currentDirectory = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(currentDirectory, '../.env');

dotenv.config({ path: envPath });

// Validate authentication configuration before starting the server.
function validateEnvironment() {
  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret || !jwtSecret.trim()) {
    throw new Error(
      'JWT_SECRET environment variable is required to start the server.'
    );
  }
}

validateEnvironment();

const { default: app } = await import('./app.js');

const port = Number(process.env.PORT || 5000);

app.listen(port, () => {
  console.log(`CampusConnect API running at http://localhost:${port}`);
  console.log(
    `Database configuration: ${
      process.env.DATABASE_URL ? 'Loaded' : 'Missing'
    }`,
  );
});