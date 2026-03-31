/**
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');

// 🌐 Mock do navegador
Object.defineProperty(global, 'navigator', {
  value: { onLine: true },
  writable: true,
});

// 🌐 Mock do DOM necessário (incluindo o forecastList que agora é renderizado via map)
document.body.innerHTML = `
  <div id="searchScreen"></div>
  <div id="weatherScreen"></div>
  <input id="cityInput" />
  <ul id="suggestionsList"></ul>
  <div id="loaderRing"></div>
  <button id="backBtn"></button>

  <span id="cityName"></span>
  <span id="cityRegion"></span>
  <span id="localTime"></span>
  <span id="weatherIcon"></span>
  <span id="tempValue"></span>
  <span id="weatherCondition"></span>
  <span id="feelsLike"></span>
  <span id="humidity"></span>
  <span id="windSpeed"></span>
  <div id="brandIcon"></div>
  <ul id="forecastList"></ul>
`;

// 🔥 Mock do fetch
global.fetch = jest.fn();

// 🔥 CARREGA o arquivo original refatorado
const code = fs.readFileSync(
  path.resolve(__dirname, '../assets/js/api.js'),
  'utf-8'
);

// 🔥 Sandbox atualizado para exportar as variáveis da nova estrutura
const wrappedCode = `
  ${code}
  return {
    WeatherService: typeof WeatherService !== 'undefined' ? WeatherService : null,
    CONFIG: typeof CONFIG !== 'undefined' ? CONFIG : null,
    renderForecast: typeof renderForecast !== 'undefined' ? renderForecast : null,
    formatters: typeof formatters !== 'undefined' ? formatters : null,
    UI: typeof UI !== 'undefined' ? UI : null
  };
`;

const { WeatherService, CONFIG, renderForecast, formatters, UI } = new Function(wrappedCode)();

// ======================================================
// 🌦️ TESTES DE WEATHER SERVICE (API)
// ======================================================
describe('WeatherService.request', () => {

  beforeEach(() => {
    fetch.mockClear();
    navigator.onLine = true;
  });

  test('Retorna dados meteorológicos válidos (Forecast)', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        current: { temperature_2m: 25 },
        daily: {
          time:                ['2025-11-01', '2025-11-02', '2025-11-03',
                                '2025-11-04', '2025-11-05', '2025-11-06'],
          weather_code:        [3, 61, 80, 95, 2, 1],
          temperature_2m_max:  [30, 28, 27, 25, 29, 31],
          temperature_2m_min:  [20, 18, 17, 15, 19, 21],
        },
        timezone: 'America/Sao_Paulo',
      })
    });

    const result = await WeatherService.request(CONFIG.WEATHER_URL, { latitude: -22.9, longitude: -43.2 });

    expect(result).toHaveProperty('current');
    expect(result.current.temperature_2m).toBe(25);
    expect(result).toHaveProperty('daily');
    expect(result.daily.time).toHaveLength(6);
  });

  test('Retorna erro de API em caso de falha genérica ou limit rate (429)', async () => {
    fetch.mockRejectedValueOnce(new Error('Erro'));

    const result = await WeatherService.request(CONFIG.WEATHER_URL, {});

    expect(result).toHaveProperty('error');
    expect(result.error).toBe('api');
  });

  test('Sem internet retorna erro offline', async () => {
    navigator.onLine = false;
    fetch.mockRejectedValueOnce(new Error('Network'));

    const result = await WeatherService.request(CONFIG.WEATHER_URL, {});

    expect(result.error).toBe('offline');
  });

  test('JSON inválido é capturado e retorna erro de API', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.reject(new Error('Invalid JSON'))
    });

    const result = await WeatherService.request(CONFIG.WEATHER_URL, {});
    
    // Na nova refatoração, erros de conversão caem no catch nativo do wrapper retornando 'api'
    expect(result.error).toBe('api');
  });

});

// ======================================================
// 🔍 TESTES DE BUSCA E UI
// ======================================================
describe('Busca de Cidades (Geocoding & UI)', () => {

  beforeEach(() => {
    fetch.mockClear();
  });

  test('WeatherService retorna lista de cidades válidas', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [
          { name: 'Rio de Janeiro' }
        ]
      })
    });

    const result = await WeatherService.request(CONFIG.GEO_URL, { name: 'Rio' });
    expect(result.results.length).toBeGreaterThan(0);
    expect(result.results[0].name).toBe('Rio de Janeiro');
  });

  test('UI.handleSearch não faz requisição se o termo for menor que o limite (MIN_QUERY_LENGTH)', async () => {
    await UI.handleSearch('A'); // Limite configurado como 2
    expect(fetch).not.toHaveBeenCalled();
  });

});

// ======================================================
// 📅 TESTES DE RENDER FORECAST
// ======================================================
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

  test('Renderiza exatamente 5 linhas (exclui o dia atual)', () => {
    renderForecast(DAILY_MOCK, 'America/Sao_Paulo');

    const rows = document.querySelectorAll('.forecast-row');
    expect(rows).toHaveLength(5);
  });

  test('Exibe a temperatura máxima e mínima corretas em cada linha', () => {
    renderForecast(DAILY_MOCK, 'America/Sao_Paulo');

    const maxValues = document.querySelectorAll('.fc-temp-val.max');
    const minValues = document.querySelectorAll('.fc-temp-val.min');

    // Índices 1–5 do mock
    expect(maxValues[0].textContent).toBe('28°');
    expect(minValues[0].textContent).toBe('18°');
    expect(maxValues[4].textContent).toBe('31°');
    expect(minValues[4].textContent).toBe('21°');
  });

  test('Não quebra quando daily é null ou undefined', () => {
    expect(() => renderForecast(null,      'America/Sao_Paulo')).not.toThrow();
    expect(() => renderForecast(undefined, 'America/Sao_Paulo')).not.toThrow();
  });

  test('Cada linha contém ícone de clima e descrição não vazia', () => {
    renderForecast(DAILY_MOCK, 'America/Sao_Paulo');

    const rows = document.querySelectorAll('.forecast-row');
    rows.forEach(row => {
      expect(row.querySelector('.fc-icon')).not.toBeNull();
      expect(row.querySelector('.fc-desc')).not.toBeNull();
      expect(row.querySelector('.fc-desc').textContent.trim()).not.toBe('');
    });
  });

});

// ======================================================
// 🗓️ TESTES DE PARSE DAY LABEL
// ======================================================
describe('formatters.parseDayLabel', () => {

  test('Retorna weekday e date como strings não vazias', () => {
    const result = formatters.parseDayLabel('2025-11-03', 'America/Sao_Paulo');

    expect(typeof result.weekday).toBe('string');
    expect(typeof result.date).toBe('string');
    expect(result.weekday.length).toBeGreaterThan(0);
    expect(result.date.length).toBeGreaterThan(0);
  });

  test('Dia da semana começa com letra maiúscula', () => {
    const result = formatters.parseDayLabel('2025-11-03', 'America/Sao_Paulo');
    expect(result.weekday[0]).toBe(result.weekday[0].toUpperCase());
  });

  test('Lança erro nativo do Intl caso o fuso horário seja inválido', () => {
    // Como simplificamos e removemos o bloco try-catch da versão antiga, 
    // a função agora delega a responsabilidade de erro ao construtor de data do JS.
    expect(() => formatters.parseDayLabel('2025-11-03', 'Fuso/Invalido')).toThrow(RangeError);
  });

});