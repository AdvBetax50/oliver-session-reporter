import { describe, expect, test } from 'vitest';
import { CACHE_PREFIX, cacheKey, isCacheable, readCachedReport, saveReportIfAbsent } from './reportCache.js';
import { reportResponse } from './test/fixtures.js';

// Reporte que pasó la validación (cacheable) para la clave indicada
const validated = ({ id = 103, language = 'en', audience = 'coach', summary = 'Primero' } = {}) => {
  const data = reportResponse({ language, audience });
  data.session = { ...data.session, id };
  data.report = { ...data.report, summary };
  data.meta = { ...data.meta, validation: { passed: true, issues: [], fallbackFields: [] } };
  return data;
};

// Storage en memoria con la misma API que localStorage
function memoryStorage() {
  const map = new Map();
  return {
    map,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

describe('reportCache', () => {
  test('la clave combina sesión + idioma + audiencia, con un prefijo versionado', () => {
    expect(cacheKey(103, 'es', 'player')).toBe(`${CACHE_PREFIX}:103:es:player`);
    expect(CACHE_PREFIX).toMatch(/^oliver:report:v\d+$/);
  });

  test('solo es cacheable un reporte que pasó la validación', () => {
    expect(isCacheable(validated())).toBe(true);
    expect(isCacheable(reportResponse())).toBe(false); // fixture con validation.passed = false
    expect(isCacheable(undefined)).toBe(false);
  });

  test('guarda el primer reporte validado y se puede leer por su clave', () => {
    const storage = memoryStorage();
    expect(saveReportIfAbsent(validated(), storage)).toBe('saved');
    expect(readCachedReport(103, 'en', 'coach', storage).report.summary).toBe('Primero');
  });

  test('NUNCA sobreescribe: un segundo reporte para la misma clave se ignora', () => {
    const storage = memoryStorage();
    saveReportIfAbsent(validated({ summary: 'Primero' }), storage);
    expect(saveReportIfAbsent(validated({ summary: 'Segundo' }), storage)).toBe('exists');
    expect(readCachedReport(103, 'en', 'coach', storage).report.summary).toBe('Primero');
  });

  test('cada combinación de sesión, idioma y audiencia es independiente', () => {
    const storage = memoryStorage();
    saveReportIfAbsent(validated({ language: 'en', audience: 'coach', summary: 'en-coach' }), storage);
    saveReportIfAbsent(validated({ language: 'es', audience: 'coach', summary: 'es-coach' }), storage);
    saveReportIfAbsent(validated({ language: 'en', audience: 'player', summary: 'en-player' }), storage);
    saveReportIfAbsent(validated({ id: 101, summary: '101-en-coach' }), storage);
    expect(storage.map.size).toBe(4);
    expect(readCachedReport(103, 'es', 'coach', storage).report.summary).toBe('es-coach');
    expect(readCachedReport(103, 'en', 'player', storage).report.summary).toBe('en-player');
    expect(readCachedReport(101, 'en', 'coach', storage).report.summary).toBe('101-en-coach');
    expect(readCachedReport(103, 'es', 'player', storage)).toBeNull();
  });

  test('no guarda un reporte con partes de respaldo (no pasó la validación)', () => {
    const storage = memoryStorage();
    expect(saveReportIfAbsent(reportResponse(), storage)).toBe('not-cacheable');
    expect(storage.map.size).toBe(0);
  });

  test('una entrada corrupta o que no corresponde a su clave se descarta y deja guardar una válida', () => {
    const storage = memoryStorage();
    storage.setItem(cacheKey(103, 'en', 'coach'), '{json roto');
    expect(readCachedReport(103, 'en', 'coach', storage)).toBeNull();
    expect(storage.map.size).toBe(0);

    storage.setItem(cacheKey(103, 'en', 'coach'), JSON.stringify(validated({ language: 'es' }))); // idioma no coincide
    expect(readCachedReport(103, 'en', 'coach', storage)).toBeNull();
    expect(saveReportIfAbsent(validated({ summary: 'Válido' }), storage)).toBe('saved');
    expect(readCachedReport(103, 'en', 'coach', storage).report.summary).toBe('Válido');
  });

  test('si localStorage no está disponible o está lleno, no rompe', () => {
    const full = { getItem: () => null, removeItem: () => {}, setItem: () => { throw new DOMException('quota', 'QuotaExceededError'); } };
    expect(saveReportIfAbsent(validated(), full)).toBe('unavailable');
    const blocked = { getItem: () => { throw new Error('SecurityError'); }, removeItem: () => { throw new Error('SecurityError'); } };
    expect(readCachedReport(103, 'en', 'coach', blocked)).toBeNull();
    expect(saveReportIfAbsent(validated(), null)).toBe('unavailable');
    expect(readCachedReport(103, 'en', 'coach', null)).toBeNull();
  });

  test('por defecto usa el localStorage real del navegador', () => {
    expect(saveReportIfAbsent(validated())).toBe('saved');
    expect(JSON.parse(window.localStorage.getItem(cacheKey(103, 'en', 'coach'))).report.summary).toBe('Primero');
    expect(readCachedReport(103, 'en', 'coach').report.summary).toBe('Primero');
  });
});
