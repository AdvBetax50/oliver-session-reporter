// JSON Schema de la respuesta del modelo, generado POR SESIÓN.
// Los player_id se restringen con `enum` a los jugadores reales de la sesión (y, en las alertas,
// a los jugadores con alertas): el proveedor que soporte salida estructurada no puede devolver
// un jugador inexistente. Se usan strings porque `enum` solo admite strings en Gemini.
// El validador vuelve a comprobarlo todo igualmente (no se confía en el proveedor).

export function buildReportSchema(context) {
  const playerIds = context.players.map((p) => String(p.player_id));
  const alertIds = context.computed_alerts.map((a) => String(a.player_id));

  const alertItem = {
    type: 'object',
    properties: {
      player_id: alertIds.length ? { type: 'string', enum: alertIds } : { type: 'string' },
      comment: { type: 'string', description: '1-2 sentences: meaning of the alert and a recommendation' },
    },
    required: ['player_id', 'comment'],
  };

  return {
    type: 'object',
    properties: {
      summary: { type: 'string', description: "3-5 sentences about the team's performance" },
      highlights: {
        type: 'array',
        minItems: Math.min(2, playerIds.length),
        maxItems: Math.min(3, playerIds.length),
        items: {
          type: 'object',
          properties: {
            player_id: { type: 'string', enum: playerIds },
            reason: { type: 'string', description: '1-2 data-backed sentences' },
          },
          required: ['player_id', 'reason'],
        },
      },
      alerts: { type: 'array', minItems: alertIds.length, maxItems: alertIds.length, items: alertItem },
    },
    required: ['summary', 'highlights', 'alerts'],
  };
}
