import { parsePositiveInt, requireEnum, singleValue } from './validation.js';

// Campos por los que se puede ordenar (?order_by=). Lista blanca: el repositorio
// traduce cada uno a una columna, así nunca se interpola texto del usuario en el SQL.
export const ORDERABLE_FIELDS = [
  'shirt_number', 'name', 'position',
  'minutes_played', 'total_distance_m', 'high_speed_running_m', 'sprints',
  'max_speed_kmh', 'accelerations', 'rpe', 'workload_au',
];
export const ORDER_DIRECTIONS = ['asc', 'desc'];

// Parámetros de GET /sessions/:id/metrics
export class MetricsQueryDTO {
  constructor({ sessionId, playerId, orderBy, order }) {
    this.sessionId = sessionId;
    this.playerId = playerId;
    this.orderBy = orderBy;
    this.order = order;
    Object.freeze(this);
  }

  static fromRequest(params, query = {}) {
    const playerId = singleValue(query.player_id, 'player_id');
    const orderBy = singleValue(query.order_by, 'order_by');
    const order = singleValue(query.order, 'order');
    return new MetricsQueryDTO({
      sessionId: parsePositiveInt(params.id, 'id'),
      playerId: playerId === undefined ? null : parsePositiveInt(playerId, 'player_id'),
      orderBy: orderBy === undefined ? 'shirt_number' : requireEnum(orderBy, 'order_by', ORDERABLE_FIELDS),
      // Por defecto: descendente al ordenar por una métrica (lo habitual: "quién corrió más"),
      // ascendente al ordenar por dorsal, nombre o posición.
      order: order === undefined
        ? (['shirt_number', 'name', 'position'].includes(orderBy ?? 'shirt_number') ? 'asc' : 'desc')
        : requireEnum(String(order).toLowerCase(), 'order', ORDER_DIRECTIONS),
    });
  }
}
