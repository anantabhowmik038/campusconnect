
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// Load environment variables using an absolute path.
const currentDirectory = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(currentDirectory, '../.env');

dotenv.config({ path: envPath });

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
