import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const nextJs = require('next') as (opts: { dev: boolean }) => { prepare: () => Promise<void>; getRequestHandler: () => (req: any, res: any) => void };
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { HardwareControllerClientServerSDK } from 'hardware-controller-sdk/client/Server';

const port = process.env.PORT || 3001;
const key = process.env.NEXT_PUBLIC_HARDWARE_SOCKET_KEY || 'secret kuno';
const dev = process.env.NODE_ENV !== 'production';
const app = nextJs({ dev });
const handle = app.getRequestHandler();

app.prepare().then(async () => {
  const server = http.createServer((req, res) => handle(req, res));

  const io = new SocketIOServer(server, {
    cors: { origin: '*' },
  });

  const sdk = new HardwareControllerClientServerSDK(io, key);
  await sdk.initialize();

  server.listen(port, () => {
    console.log(`🚀 RFID Locker server running on http://localhost:${port}`);
  });
});
