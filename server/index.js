import dotenv from 'dotenv';
import path from 'path';
import app from './app.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const PORT = process.env.PORT || 3259;

app.listen(PORT, () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
