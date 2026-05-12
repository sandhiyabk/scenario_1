import { createServer } from 'node:http';
import app from '../src/app.js';

const server = createServer(app);

server.listen(3000, () => {
  console.log('Backend running on port 3000');
});