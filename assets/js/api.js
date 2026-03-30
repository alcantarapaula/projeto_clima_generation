/* ════════════════════════════════════════════════
   CLIMA — API & Lógica da Aplicação (Refatorado)
   ════════════════════════════════════════════════ */

// ── Endpoints ─────────────────────────────────────
const GEO_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast';
const DEBOUNCE_MS = 340;

// ── Constantes reutilizáveis ──────────────────────
const MIN_QUERY_LENGTH = 2;

// ── Mapeamento WMO ───────────────────────────────
const WMO_DESC = {
  0: 'Céu limpo',
  1: 'Principalmente limpo',
  2: 'Parcialmente nublado',
  3: 'Nublado',
  45: 'Nevoeiro',
  48: 'Nevoeiro com geada',
  51: 'Garoa leve',
  53: 'Garoa moderada',
  55: 'Garoa intensa',
  56: 'Garoa congelante leve',
  57: 'Garoa congelante intensa',
  61: 'Chuva leve',
  63: 'Chuva moderada',
  65: 'Chuva forte',
  66: 'Chuva congelante leve',
  67: 'Chuva congelante intensa',
  71: 'Neve leve',
  73: 'Neve moderada',
  75: 'Neve forte',
  77: 'Granizo de neve',
  80: 'Pancadas de chuva leves',
  81: 'Pancadas de chuva moderadas',
  82: 'Pancadas de chuva fortes',
  85: 'Pancadas de neve leves',
  86: 'Pancadas de neve fortes',
  95: 'Tempestade',
  96: 'Tempestade com granizo leve',
  99: 'Tempestade com granizo forte',
};

// ── Helpers ──────────────────────────────────────
const isValidQuery = (query) =>
  typeof query === 'string' && query.trim().length >= MIN_QUERY_LENGTH;

const buildURL = (base, params) =>
  `${base}?${new URLSearchParams(params)}`;


/**
 * Trata erros de requisição à API e padroniza o retorno.
 *
 * @function handleFetchError
 * @param {string} context - Nome da função que gerou o erro
 * @param {Error} err - Objeto de erro capturado
 *
 * @returns {{error: string}}
 * Retorna:
 * - 'offline' quando não há conexão com internet
 * - 'api' para outros erros
 *
 * @example
 * const result = handleFetchError('fetchWeather', error);
 */
const handleFetchError = (context, err) => {
  console.error(`[Clima] ${context}:`, err);

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { error: 'offline' };
  }

  return { error: 'api' };
};

// ── Ícones ───────────────────────────────────────
function getWeatherIcon(code, isDay) {
  if (code === 0) return isDay ? 'wi-day-sunny' : 'wi-night-clear';
  if (code <= 2) return isDay ? 'wi-day-cloudy' : 'wi-night-alt-partly-cloudy';
  if (code === 3) return isDay ? 'wi-day-cloudy' : 'wi-night-alt-cloudy';
  if (code <= 48) return isDay ? 'wi-day-fog' : 'wi-night-fog';
  if (code <= 57) return isDay ? 'wi-day-sprinkle' : 'wi-night-alt-sprinkle';
  if (code <= 65) return isDay ? 'wi-day-rain' : 'wi-night-alt-rain';
  if (code <= 67) return isDay ? 'wi-day-rain-mix' : 'wi-night-alt-rain-mix';
  if (code <= 77) return isDay ? 'wi-day-snow' : 'wi-night-alt-snow';
  if (code <= 82) return isDay ? 'wi-day-showers' : 'wi-night-alt-showers';
  if (code <= 86) return isDay ? 'wi-day-snow-wind' : 'wi-night-alt-snow-wind';
  if (code >= 95) return isDay ? 'wi-day-thunderstorm' : 'wi-night-alt-thunderstorm';

  return isDay ? 'wi-day-sunny' : 'wi-night-clear';
}

// ── Tema ─────────────────────────────────────────
function applyTheme() {
  const hour = new Date().getHours();
  const mode = hour >= 6 && hour < 18 ? 'day' : 'night';

  document.documentElement.setAttribute('data-mode', mode);

  const brandIcon = document.getElementById('brandIcon');
  if (brandIcon) {
    brandIcon.className =
      mode === 'day'
        ? 'wi wi-day-sunny brand-icon'
        : 'wi wi-night-clear brand-icon';
  }
}

// ── Data/Hora ────────────────────────────────────
function formatLocalTime(timezone) {
  try {
    const now = new Date();

    const time = new Intl.DateTimeFormat('pt-BR', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
    }).format(now);

    const date = new Intl.DateTimeFormat('pt-BR', {
      timeZone: timezone,
      weekday: 'short',
      day: 'numeric',
      month: 'long',
    }).format(now);

    return `${date.replace('.', '')} · ${time}`;
  } catch {
    return new Date().toLocaleString('pt-BR');
  }
}

// ── API: Buscar cidades ──────────────────────────
/**
 * Busca cidades com base em um termo usando a API de geocoding.
 *
 * @async
 * @function searchCities
 * @param {string} query - Nome da cidade (mínimo de 2 caracteres)
 *
 * @returns {Promise<Array<Object>>}
 * Retorna uma lista de cidades encontradas.
 * Retorna array vazio em caso de erro ou nenhuma correspondência.
 *
 * @throws {Error} Lança erro caso a requisição HTTP falhe (capturado internamente).
 *
 * @example
 * const cities = await searchCities('São Paulo');
 * console.log(cities);
 */
async function searchCities(query) {
  if (!isValidQuery(query)) return [];

  try {
    const url = buildURL(GEO_URL, {
      name: query.trim(),
      count: 6,
      language: 'pt',
      format: 'json',
    });

    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    return Array.isArray(data.results) ? data.results : [];
  } catch (err) {
    console.error('[Clima] searchCities:', err);
    return [];
  }
}

// ── API: Buscar clima ────────────────────────────
/**
 * Busca dados meteorológicos atuais de uma localização.
 *
 * @async
 * @function fetchWeather
 * @param {number} lat - Latitude da localização
 * @param {number} lon - Longitude da localização
 *
 * @returns {Promise<Object>}
 * Retorna os dados do clima no formato da API ou:
 * { error: 'offline' } quando sem internet
 * { error: 'api' } quando ocorre erro na API
 * { error: 'invalid_data' } quando a resposta é inválida
 *
 * @throws {Error} Lança erro HTTP (ex: 404, 429) antes de ser tratado.
 *
 * @example
 * const weather = await fetchWeather(-23.55, -46.63);
 * if (!weather.error) {
 *   console.log(weather.current.temperature_2m);
 * }
 */
async function fetchWeather(lat, lon) {
  try {
    const url = buildURL(WEATHER_URL, {
      latitude: lat,
      longitude: lon,
      current: [
        'temperature_2m',
        'apparent_temperature',
        'relative_humidity_2m',
        'weather_code',
        'wind_speed_10m',
        'is_day',
      ].join(','),
      timezone: 'auto',
      wind_speed_unit: 'kmh',
    });

    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();

    // 🔥 Validação importante (evita quebrar UI)
    if (!data || !data.current) {
      return { error: 'invalid_data' };
    }

    return data;
  } catch (err) {
    return handleFetchError('fetchWeather', err);
  }
}

// ── Debounce ─────────────────────────────────────
/**
 * Cria uma versão "debounced" de uma função.
 *
 * @function debounce
 * @param {Function} fn - Função a ser executada
 * @param {number} delay - Tempo de espera em milissegundos
 *
 * @returns {Function}
 * Retorna uma nova função que só executa após o delay.
 *
 * @example
 * const delayedSearch = debounce((value) => {
 *   console.log(value);
 * }, 300);
 */
function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// ── DOM helpers ──────────────────────────────────
const getEl = (id) => document.getElementById(id);

// ── Referências DOM ──────────────────────────────
const searchScreen = getEl('searchScreen');
const weatherScreen = getEl('weatherScreen');
const cityInput = getEl('cityInput');
const suggestionsList = getEl('suggestionsList');
const loaderRing = getEl('loaderRing');
const backBtn = getEl('backBtn');

const elCityName = getEl('cityName');
const elCityRegion = getEl('cityRegion');
const elLocalTime = getEl('localTime');
const elWeatherIcon = getEl('weatherIcon');
const elTempValue = getEl('tempValue');
const elCondition = getEl('weatherCondition');
const elFeelsLike = getEl('feelsLike');
const elHumidity = getEl('humidity');
const elWindSpeed = getEl('windSpeed');

// ── UI helpers ───────────────────────────────────
const setLoading = (state) =>
  loaderRing?.classList[state ? 'add' : 'remove']('active');

const clearSuggestions = () => {
  suggestionsList.innerHTML = '';
  suggestionsList.classList.remove('open');
};

// ── Render sugestões ─────────────────────────────
function renderSuggestions(cities) {
  clearSuggestions();

  if (!cities.length) {
    suggestionsList.innerHTML = `
      <li class="suggestion-item">
        <span class="sug-name">Cidade não encontrada</span>
      </li>
    `;
    suggestionsList.classList.add('open');
    return;
  }

  cities.forEach((city) => {
    const li = document.createElement('li');

    const region = [city.admin1, city.country]
      .filter(Boolean)
      .join(' · ');

    li.className = 'suggestion-item';
    li.innerHTML = `
      <span class="sug-name">${city.name}</span>
      <span class="sug-region">${region}</span>
    `;

    li.onclick = () => selectCity(city);
    suggestionsList.appendChild(li);
  });

  suggestionsList.classList.add('open');
}

// ── Seleção de cidade ────────────────────────────
async function selectCity(city) {
  clearSuggestions();
  cityInput.value = '';

  searchScreen.classList.add('hidden');
  weatherScreen.classList.remove('hidden');

  elCityName.textContent = city.name;
  elCityRegion.textContent = [city.admin1, city.country]
    .filter(Boolean)
    .join(' · ');

  const data = await fetchWeather(city.latitude, city.longitude);

  if (data.error) {
    elCondition.textContent =
      data.error === 'offline'
        ? 'Sem conexão com a internet.'
        : 'Erro ao carregar clima.';
    return;
  }

  const c = data.current;

  elTempValue.textContent = Math.round(c.temperature_2m);
  elCondition.textContent = WMO_DESC[c.weather_code] || 'Desconhecido';
  elFeelsLike.textContent = `Sensação térmica ${Math.round(
    c.apparent_temperature
  )}°C`;
  elHumidity.textContent = `${c.relative_humidity_2m}%`;
  elWindSpeed.textContent = `${Math.round(c.wind_speed_10m)} km/h`;
  elLocalTime.textContent = formatLocalTime(data.timezone);

  elWeatherIcon.className = `wi ${getWeatherIcon(
    c.weather_code,
    c.is_day === 1
  )}`;
}

// ── Eventos ──────────────────────────────────────
const handleInput = debounce(async (value) => {
  if (!isValidQuery(value)) {
    clearSuggestions();
    return;
  }

  setLoading(true);
  const cities = await searchCities(value);
  setLoading(false);

  renderSuggestions(cities);
}, DEBOUNCE_MS);

cityInput?.addEventListener('input', (e) =>
  handleInput(e.target.value)
);

backBtn?.addEventListener('click', () => {
  weatherScreen.classList.add('hidden');
  searchScreen.classList.remove('hidden');
});

// ── Inicialização ────────────────────────────────
if (typeof document !== 'undefined') {
  applyTheme();
  setInterval(applyTheme, 60000);
}

// ── Export (mantém compatível com seus testes) ──
if (typeof module !== 'undefined') {
  module.exports = { fetchWeather, searchCities };
}