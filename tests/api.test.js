/**
 * @jest-environment jsdom
 */

const fs   = require('fs');
const path = require('path');

// ── Mock do navegador ─────────────────────────────
Object.defineProperty(global, 'navigator', {
  value: { onLine: true },
  writable: true,
});

// ── Mock do DOM ───────────────────────────────────
document.body.innerHTML = `
  <div id="searchScreen"></div>
  <div id="weatherScreen" class="hidden"></div>
  <canvas id="weatherCanvas"></canvas>
  <input id="cityInput" />
  <ul id="suggestionsList"></ul>
  <div id="loaderRing"></div>
  <button id="backBtn"></button>
  <span id="cityName"></span>
  <span id="cityRegion"></span>
  <span id="localTime"></span>
  <i id="weatherIcon"></i>
  <span id="tempValue"></span>
  <span id="weatherCondition"></span>
  <span id="feelsLike"></span>
  <span id="humidity"></span>
  <span id="windSpeed"></span>
  <div id="brandIcon"></div>
  <ul id="forecastList"></ul>
`;

// ── Mock do fetch ─────────────────────────────────
global.fetch = jest.fn();

// ── Carrega o api.js e expõe as funções internas ──
const code = fs.readFileSync(
  path.resolve(__dirname, '../assets/js/api.js'),
  'utf-8'
);

const wrappedCode = `
  ${code}
  return {
    fetchWeather:     typeof fetchWeather     !== 'undefined' ? fetchWeather     : null,
    searchCities:     typeof searchCities     !== 'undefined' ? searchCities     : null,
    renderForecast:   typeof renderForecast   !== 'undefined' ? renderForecast   : null,
    parseDayLabel:    typeof parseDayLabel     !== 'undefined' ? parseDayLabel    : null,
    isValidQuery:     typeof isValidQuery     !== 'undefined' ? isValidQuery     : null,
    MIN_QUERY_LENGTH: typeof MIN_QUERY_LENGTH !== 'undefined' ? MIN_QUERY_LENGTH : null,
  };
`;

const {
  fetchWeather,
  searchCities,
  renderForecast,
  parseDayLabel,
  isValidQuery,
  MIN_QUERY_LENGTH,
} = new Function(wrappedCode)();


// ══════════════════════════════════════════════════
// 🌦️ TESTES DE fetchWeather
// ══════════════════════════════════════════════════
describe('fetchWeather', () => {

  beforeEach(() => {
    fetch.mockClear();
    navigator.onLine = true;
  });

  test('Retorna dados meteorológicos válidos incluindo current e daily', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        current: { temperature_2m: 25, is_day: 1, weather_code: 3 },
        daily: {
          time:               ['2025-11-01', '2025-11-02', '2025-11-03',
                               '2025-11-04', '2025-11-05', '2025-11-06'],
          weather_code:       [3, 61, 80, 95, 2, 1],
          temperature_2m_max: [30, 28, 27, 25, 29, 31],
          temperature_2m_min: [20, 18, 17, 15, 19, 21],
        },
        timezone: 'America/Sao_Paulo',
      }),
    });

    const result = await fetchWeather(-22.9, -43.2);

    expect(result).toHaveProperty('current');
    expect(result.current.temperature_2m).toBe(25);
    expect(result).toHaveProperty('daily');
    expect(result.daily.time).toHaveLength(6);
    expect(result.daily).toHaveProperty('temperature_2m_max');
    expect(result.daily).toHaveProperty('temperature_2m_min');
  });

  test('Retorna { error: "api" } em caso de erro genérico da requisição', async () => {
    fetch.mockRejectedValueOnce(new Error('Network error'));

    const result = await fetchWeather(-22.9, -43.2);

    expect(result).toHaveProperty('error');
    expect(result.error).toBe('api');
  });

  test('Retorna { error: "api" } para resposta HTTP não-ok (ex: 429)', async () => {
    fetch.mockResolvedValueOnce({ ok: false, status: 429 });

    const result = await fetchWeather(-22.9, -43.2);

    expect(result).toHaveProperty('error');
    expect(result.error).toBe('api');
  });

  test('Retorna { error: "offline" } quando não há conexão com a internet', async () => {
    navigator.onLine = false;
    fetch.mockRejectedValueOnce(new Error('Network'));

    const result = await fetchWeather(-22.9, -43.2);

    expect(result.error).toBe('offline');
  });

  test('Retorna { error: "invalid_data" } quando a resposta não contém current', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    const result = await fetchWeather(-22.9, -43.2);

    expect(result).toHaveProperty('error');
    expect(result.error).toBe('invalid_data');
  });

  test('Conexão lenta ainda retorna dados corretamente', async () => {
    fetch.mockImplementationOnce(() =>
      new Promise((resolve) =>
        setTimeout(() =>
          resolve({
            ok: true,
            json: async () => ({
              current: { temperature_2m: 20 },
              daily: { time: [], weather_code: [],
                temperature_2m_max: [], temperature_2m_min: [] },
              timezone: 'America/Sao_Paulo',
            }),
          }), 200)
      )
    );

    const result = await fetchWeather(-22.9, -43.2);
    expect(result.current.temperature_2m).toBe(20);
  });

});


// ══════════════════════════════════════════════════
// 🔍 TESTES DE searchCities
// ══════════════════════════════════════════════════
describe('searchCities', () => {

  beforeEach(() => {
    fetch.mockClear();
    navigator.onLine = true;
  });

  test('Retorna lista de cidades válidas', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ results: [{ name: 'Rio de Janeiro' }] }),
    });

    const result = await searchCities('Rio');

    expect(result.length).toBeGreaterThan(0);
    expect(result[0].name).toBe('Rio de Janeiro');
  });

  test('Retorna array vazio quando a cidade não é encontrada', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ results: [] }),
    });

    const result = await searchCities('cidadeinexistente');

    expect(result).toEqual([]);
  });

  test('Não faz requisição quando a entrada está abaixo do comprimento mínimo', async () => {
    const result = await searchCities('a');

    expect(result).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  test('Não faz requisição para entrada vazia', async () => {
    const result = await searchCities('');

    expect(result).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  test('Retorna array vazio em caso de erro de rede', async () => {
    fetch.mockRejectedValueOnce(new Error('Network error'));

    const result = await searchCities('São Paulo');

    expect(result).toEqual([]);
  });

});


// ══════════════════════════════════════════════════
// 📅 TESTES DE renderForecast
// ══════════════════════════════════════════════════
describe('renderForecast', () => {

  beforeEach(() => {
    const list = document.getElementById('forecastList');
    if (list) list.innerHTML = '';
  });

  const DAILY_MOCK = {
    time:               ['2025-11-01', '2025-11-02', '2025-11-03',
                         '2025-11-04', '2025-11-05', '2025-11-06'],
    weather_code:       [3, 61, 80, 95, 2, 1],
    temperature_2m_max: [30, 28, 27, 25, 29, 31],
    temperature_2m_min: [20, 18, 17, 15, 19, 21],
  };

  test('Renderiza exatamente 5 linhas (exclui o índice 0 — dia atual)', () => {
    renderForecast(DAILY_MOCK, 'America/Sao_Paulo');

    const rows = document.querySelectorAll('.forecast-row');
    expect(rows).toHaveLength(5);
  });

  test('Exibe as temperaturas máxima e mínima corretas em cada linha', () => {
    renderForecast(DAILY_MOCK, 'America/Sao_Paulo');

    const maxValues = document.querySelectorAll('.fc-temp-val.max');
    const minValues = document.querySelectorAll('.fc-temp-val.min');

    expect(maxValues[0].textContent).toBe('28°');
    expect(minValues[0].textContent).toBe('18°');
    expect(maxValues[4].textContent).toBe('31°');
    expect(minValues[4].textContent).toBe('21°');
  });

  test('Aplica delay de animação escalonado em cada linha', () => {
    renderForecast(DAILY_MOCK, 'America/Sao_Paulo');

    const rows = document.querySelectorAll('.forecast-row');
    rows.forEach((row, i) => {
      expect(row.style.animationDelay).toBe(`${i * 60}ms`);
    });
  });

  test('Não quebra quando daily é null', () => {
    expect(() => renderForecast(null, 'America/Sao_Paulo')).not.toThrow();
  });

  test('Não quebra quando daily é undefined', () => {
    expect(() => renderForecast(undefined, 'America/Sao_Paulo')).not.toThrow();
  });

  test('Renderiza apenas os dias disponíveis quando daily tem menos de 6 entradas', () => {
    const shortDaily = {
      time:               ['2025-11-01', '2025-11-02'],
      weather_code:       [3, 61],
      temperature_2m_max: [30, 28],
      temperature_2m_min: [20, 18],
    };

    expect(() => renderForecast(shortDaily, 'America/Sao_Paulo')).not.toThrow();

    const rows = document.querySelectorAll('.forecast-row');
    expect(rows).toHaveLength(1);
  });

  test('Cada linha contém ícone de clima e descrição não vazia', () => {
    renderForecast(DAILY_MOCK, 'America/Sao_Paulo');

    document.querySelectorAll('.forecast-row').forEach(row => {
      expect(row.querySelector('.fc-icon')).not.toBeNull();
      expect(row.querySelector('.fc-desc')).not.toBeNull();
      expect(row.querySelector('.fc-desc').textContent.trim()).not.toBe('');
    });
  });

});


// ══════════════════════════════════════════════════
// 🗓️ TESTES DE parseDayLabel
// ══════════════════════════════════════════════════
describe('parseDayLabel', () => {

  test('Retorna weekday e date como strings não vazias', () => {
    const result = parseDayLabel('2025-11-03', 'America/Sao_Paulo');

    expect(typeof result.weekday).toBe('string');
    expect(typeof result.date).toBe('string');
    expect(result.weekday.length).toBeGreaterThan(0);
    expect(result.date.length).toBeGreaterThan(0);
  });

  test('Dia da semana começa com letra maiúscula', () => {
    const result = parseDayLabel('2025-11-03', 'America/Sao_Paulo');

    expect(result.weekday[0]).toBe(result.weekday[0].toUpperCase());
  });

  test('Retorna resultado válido para fuso do outro lado do mundo', () => {
    const result = parseDayLabel('2025-11-03', 'Asia/Tokyo');

    expect(result).toHaveProperty('weekday');
    expect(result).toHaveProperty('date');
    expect(result.weekday.length).toBeGreaterThan(0);
  });

  test('Lança RangeError para fuso horário inválido', () => {
    expect(() => parseDayLabel('2025-11-03', 'Fuso/Invalido')).toThrow(RangeError);
  });

});


// ══════════════════════════════════════════════════
// 🔒 TESTES DE isValidQuery
// ══════════════════════════════════════════════════
describe('isValidQuery', () => {

  test('Retorna true para query com comprimento mínimo atingido', () => {
    expect(isValidQuery('ab')).toBe(true);
    expect(isValidQuery('São Paulo')).toBe(true);
  });

  test('Retorna false para string abaixo do comprimento mínimo', () => {
    expect(isValidQuery('a')).toBe(false);
    expect(isValidQuery('')).toBe(false);
  });

  test('Retorna false para tipos não-string (null, undefined, number)', () => {
    expect(isValidQuery(null)).toBe(false);
    expect(isValidQuery(undefined)).toBe(false);
    expect(isValidQuery(123)).toBe(false);
  });

  test('Retorna false para string com só espaços em branco', () => {
    expect(isValidQuery('   ')).toBe(false);
  });

  test('MIN_QUERY_LENGTH está definido como 2', () => {
    expect(MIN_QUERY_LENGTH).toBe(2);
  });

});
