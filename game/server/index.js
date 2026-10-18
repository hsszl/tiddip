import { createApp } from './app.js';

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '127.0.0.1';
const server = createApp();

server.on('error', error => {
  console.error(`Server could not start: ${error.message}`);
  process.exitCode = 1;
});
server.listen(port, host, () => console.log(`Local: http://${host}:${server.address().port}/game/`));

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.closeAllConnections();
    server.close(() => process.exit(0));
  });
}
