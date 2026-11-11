// Validadores compartidos por los DTOs de entrada.
export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.status = 400;
    this.expose = true;
  }
}

// Para parámetros de URL / query string, que siempre llegan como texto.
export function parsePositiveInt(value, field) {
  if (typeof value !== 'string' || !/^\d+$/.test(value) || Number(value) < 1 || !Number.isSafeInteger(Number(value))) {
    throw new ValidationError(`${field} debe ser un entero positivo (recibido: ${JSON.stringify(value)})`);
  }
  return Number(value);
}

// Un parámetro de query repetido (?a=1&a=2) llega como array: se rechaza.
export function singleValue(value, field) {
  if (Array.isArray(value)) throw new ValidationError(`${field} solo admite un valor`);
  return value;
}

export function requireInt(value, field, { min = -Infinity, max = Infinity } = {}) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new ValidationError(`${field} debe ser un entero entre ${min} y ${max} (recibido: ${JSON.stringify(value)})`);
  }
  return value;
}

export function optionalInt(value, field, range) {
  return value === null || value === undefined ? null : requireInt(value, field, range);
}

export function requireNumber(value, field, { min = -Infinity } = {}) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min) {
    throw new ValidationError(`${field} debe ser un número >= ${min} (recibido: ${JSON.stringify(value)})`);
  }
  return value;
}

export function optionalNumber(value, field, range) {
  return value === null || value === undefined ? null : requireNumber(value, field, range);
}

export function requireString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ValidationError(`${field} debe ser un texto no vacío`);
  }
  return value.trim();
}

export function requireEnum(value, field, allowed) {
  if (!allowed.includes(value)) {
    throw new ValidationError(`${field} debe ser uno de [${allowed.join(', ')}] (recibido: ${JSON.stringify(value)})`);
  }
  return value;
}

export function requireDate(value, field) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value))) {
    throw new ValidationError(`${field} debe ser una fecha YYYY-MM-DD (recibido: ${JSON.stringify(value)})`);
  }
  return value;
}

// NUMERIC llega de pg como string para no perder precisión; se convierte al leer.
export const toNumberOrNull = (value) => (value === null || value === undefined ? null : Number(value));
