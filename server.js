import dotenv from 'dotenv';
import path from 'path';
import app from './server/app.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Root server.js started on http://0.0.0.0:${PORT}`);
});
