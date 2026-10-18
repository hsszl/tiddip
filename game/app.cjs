// Passenger can load this CommonJS entry while the game remains ES modules.
import('./server/index.js').catch(error => {
  console.error('Game startup failed:', error.message);
  process.exitCode = 1;
});
