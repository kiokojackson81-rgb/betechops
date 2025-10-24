/* eslint-disable @typescript-eslint/no-require-imports */
const net = require('net');
const host = '127.0.0.1';
const port = parseInt(process.env.PORT || '3001', 10);
const socket = new net.Socket();
socket.setTimeout(5000);
socket.on('connect', () => {
  console.log('TCP CONNECTED to', host + ':' + port);
  socket.end();
});
socket.on('timeout', () => {
  console.log('TCP TIMEOUT');
  socket.destroy();
});
socket.on('error', (err) => {
  console.log('TCP ERROR:', err && err.code ? `${err.code} - ${err.message}` : String(err));
});
socket.on('close', (hadError) => {
  console.log('TCP CLOSED', hadError ? 'with error' : '');
});
socket.connect(port, host);
