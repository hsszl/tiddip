export class GameError extends Error {
  constructor(message, status = 409) {
    super(message);
    this.status = status;
  }
}

export function requireThat(condition, message, status) {
  if (!condition) throw new GameError(message, status);
}
