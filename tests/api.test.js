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

// 🔥 ISOLA e "exporta" funções sem mexer no arquivo original
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

describe('Testes da aplicação de clima', () => {

  beforeEach(() => {
    fetch.mockClear();
    navigator.onLine = true;
  });

  // 1. Cidade válida
  test('Cidade válida retorna dados meteorológicos', async () => {
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

  // 2. Cidade inexistente
  test('Cidade inexistente retorna lista vazia', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ results: [] })
    });

    const result = await searchCities('cidadeinexistente');

    expect(result).toEqual([]);
  });

  // 3. Entrada vazia
  test('Entrada vazia retorna erro de validação', async () => {
    const result = await searchCities('');

    expect(result).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  // 4. Falha da API
  test('Falha da API retorna erro adequado', async () => {
    fetch.mockRejectedValueOnce(new Error('Erro API'));

    const result = await fetchWeather(-22.9, -43.2);

    expect(result).toHaveProperty('error');
    expect(result.error).toBe('api');
  });

  // 5. Sem internet
  test('Sem internet retorna erro offline', async () => {
    navigator.onLine = false;

    fetch.mockRejectedValueOnce(new Error('Network'));

    const result = await fetchWeather(-22.9, -43.2);

    expect(result.error).toBe('offline');
  });

  // 6. Limite de requisições excedido
test('Limite de requisições da API excedido', async () => {
  fetch.mockResolvedValueOnce({
    ok: false,
    status: 429,
    json: async () => ({})
  });

  const result = await fetchWeather(-22.9, -43.2);

  expect(result).toHaveProperty('error');
  expect(result.error).toBe('api'); // ou ajuste se você tratar diferente
});


// 7. Conexão lenta / instável
test('Conexão de rede lenta ou instável', async () => {
  fetch.mockImplementationOnce(() =>
    new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          ok: true,
          json: async () => ({
            current: { temperature_2m: 20 }
          })
        });
      }, 200); // simula delay
    })
  );

  const result = await fetchWeather(-22.9, -43.2);

  expect(result).toHaveProperty('current');
  expect(result.current.temperature_2m).toBe(20);
});


// 8. Mudança inesperada no JSON
test('Mudança inesperada no formato da resposta JSON', async () => {
  fetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      unexpected: true // estrutura errada
    })
  });

  const result = await fetchWeather(-22.9, -43.2);

  // Esperamos que o sistema não quebre
  expect(result).toBeDefined();

  // ideal: seu código tratar isso como erro
  if (result.error) {
    expect(result.error).toBe('api');
  }
});

});