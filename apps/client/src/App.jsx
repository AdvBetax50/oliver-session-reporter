import { useEffect, useState } from 'react';
import { apiGet } from './api.js';

export default function App() {
  const [health, setHealth] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiGet('/health').then(setHealth).catch((e) => setError(e.message));
  }, []);

  return (
    <main className="container">
      <h1>Oliver</h1>
      <section className="card">
        <h2>Estado del sistema</h2>
        {!health && !error && <p>Comprobando conexión…</p>}
        {error && <p className="error">API / base de datos no disponible: {error}</p>}
        {health && (
          <p className="ok">
            API conectada a la base de datos <strong>{health.database}</strong>
          </p>
        )}
      </section>
    </main>
  );
}
