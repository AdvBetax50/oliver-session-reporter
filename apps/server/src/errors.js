// Errores con código HTTP. `expose = true` indica que el mensaje es seguro para el cliente.
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.expose = true;
  }
}

export class NotFoundError extends HttpError {
  constructor(message) {
    super(404, message);
    this.name = 'NotFoundError';
  }
}
