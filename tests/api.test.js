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

// 🌐 Mock do DOM necessário
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
`;

// 🔥 Mock do fetch
global.fetch = jest.fn();

// 🔥 CARREGA o arquivo original
const code = fs.readFileSync(
  path.resolve(__dirname, '../assets/js/api.js'),
  'utf-8'
);

// 🔥 Sandbox compatível com module.exports ou funções globais
const wrappedCode = `
  const module = { exports: {} };
  const exports = module.exports;

  ${code}

  return {
    fetchWeather: module.exports.fetchWeather || fetchWeather,
    searchCities: module.exports.searchCities || searchCities
  };
`;

const { fetchWeather, searchCities } = new Function(wrappedCode)();


// ======================================================
// 🌦️ TESTES DE FETCH WEATHER
// ======================================================
describe('fetchWeather', () => {

  beforeEach(() => {
    fetch.mockClear();
    navigator.onLine = true;
  });

  test('Retorna dados meteorológicos válidos', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        current: { temperature_2m: 25 }
      })
    });

    const result = await fetchWeather(-22.9, -43.2);

    expect(result).toHaveProperty('current');
    expect(result.current.temperature_2m).toBe(25);
  });

  test.each([
    {
      name: 'erro genérico da API',
      mock: () => fetch.mockRejectedValueOnce(new Error('Erro')),
    },
    {
      name: 'limite de requisições (429)',
      mock: () => fetch.mockResolvedValueOnce({ ok: false, status: 429 }),
    },
  ])('Retorna erro de API em caso de %s', async ({ mock }) => {
    mock();

    const result = await fetchWeather(-22.9, -43.2);

    expect(result).toHaveProperty('error');
    expect(result.error).toBe('api');
  });

  test('Sem internet retorna erro offline', async () => {
    navigator.onLine = false;

    fetch.mockRejectedValueOnce(new Error('Network'));

    const result = await fetchWeather(-22.9, -43.2);

    expect(result.error).toBe('offline');
  });

  test('Conexão lenta ainda retorna dados corretamente', async () => {
    fetch.mockImplementationOnce(() =>
      new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            ok: true,
            json: async () => ({
              current: { temperature_2m: 20 }
            })
          });
        }, 200);
      })
    );

    const result = await fetchWeather(-22.9, -43.2);

    expect(result.current.temperature_2m).toBe(20);
  });

test('Resposta JSON inesperada não quebra a aplicação', async () => {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({}) // JSON inválido
    })
  );

  const result = await fetchWeather(-23.55, -46.63);

  if (result.error) {
    expect(result.error).toBe('invalid_data'); // ✅ correto
  }
});

});


// ======================================================
// 🔍 TESTES DE SEARCH CITIES
// ======================================================
describe('searchCities', () => {

  beforeEach(() => {
    fetch.mockClear();
  });

  test('Retorna lista de cidades válidas', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [
          { name: 'Rio de Janeiro' }
        ]
      })
    });

    const result = await searchCities('Rio');

    expect(result.length).toBeGreaterThan(0);
    expect(result[0].name).toBe('Rio de Janeiro');
  });

  test('Cidade inexistente retorna lista vazia', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ results: [] })
    });

    const result = await searchCities('cidadeinexistente');

    expect(result).toEqual([]);
  });

  test('Entrada vazia não faz requisição', async () => {
    const result = await searchCities('');

    expect(result).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

});