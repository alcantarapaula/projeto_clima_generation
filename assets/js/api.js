/* ════════════════════════════════════════════════
   CLIMA — API & Lógica da Aplicação
   Open-Meteo Geocoding + Weather APIs
   ════════════════════════════════════════════════ */

// ── Endpoints ─────────────────────────────────────
const GEO_URL     = 'https://geocoding-api.open-meteo.com/v1/search';
const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast';

// Tempo de espera (ms) após digitar antes de buscar
const DEBOUNCE_MS = 340;

/* ════════════════════════════════════════════════
   MAPEAMENTO WMO → DESCRIÇÃO (pt-BR)
   Referência: https://open-meteo.com/en/docs
   ════════════════════════════════════════════════ */
const WMO_DESC = {
  0:  'Céu limpo',
  1:  'Principalmente limpo',
  2:  'Parcialmente nublado',
  3:  'Nublado',
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

/* ════════════════════════════════════════════════
   MAPEAMENTO WMO → ÍCONE (Erik Flowers Weather Icons)
   Variantes: dia (is_day = 1) e noite (is_day = 0)
   ════════════════════════════════════════════════ */
function getWeatherIcon(code, isDay) {
  // Céu limpo
  if (code === 0)          return isDay ? 'wi-day-sunny'              : 'wi-night-clear';
  // Principalmente limpo / parcialmente nublado
  if (code === 1)          return isDay ? 'wi-day-sunny-overcast'     : 'wi-night-alt-partly-cloudy';
  if (code === 2)          return isDay ? 'wi-day-cloudy'             : 'wi-night-alt-partly-cloudy';
  // Nublado
  if (code === 3)          return isDay ? 'wi-day-cloudy'             : 'wi-night-alt-cloudy';
  // Nevoeiro
  if (code <= 48)          return isDay ? 'wi-day-fog'                : 'wi-night-fog';
  // Garoa
  if (code <= 57)          return isDay ? 'wi-day-sprinkle'           : 'wi-night-alt-sprinkle';
  // Chuva
  if (code <= 65)          return isDay ? 'wi-day-rain'               : 'wi-night-alt-rain';
  // Chuva congelante
  if (code <= 67)          return isDay ? 'wi-day-rain-mix'           : 'wi-night-alt-rain-mix';
  // Neve
  if (code <= 75)          return isDay ? 'wi-day-snow'               : 'wi-night-alt-snow';
  // Granizo de neve
  if (code === 77)         return isDay ? 'wi-day-snow'               : 'wi-night-alt-snow';
  // Pancadas de chuva
  if (code <= 82)          return isDay ? 'wi-day-showers'            : 'wi-night-alt-showers';
  // Pancadas de neve
  if (code <= 86)          return isDay ? 'wi-day-snow-wind'          : 'wi-night-alt-snow-wind';
  // Tempestade
  if (code >= 95)          return isDay ? 'wi-day-thunderstorm'       : 'wi-night-alt-thunderstorm';

  return isDay ? 'wi-day-sunny' : 'wi-night-clear';
}

/* ════════════════════════════════════════════════
   TEMA: DIA / NOITE
   Das 06h às 18h → modo dia
   Das 18h às 06h → modo noite
   ════════════════════════════════════════════════ */
function applyTheme() {
  const hour = new Date().getHours();
  const mode = (hour >= 6 && hour < 18) ? 'day' : 'night';
  document.documentElement.setAttribute('data-mode', mode);

  // Atualiza o ícone da marca conforme o modo
  const brandIcon = document.getElementById('brandIcon');
  if (brandIcon) {
    brandIcon.className = mode === 'day'
      ? 'wi wi-day-sunny brand-icon'
      : 'wi wi-night-clear brand-icon';
  }
}


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

    // Ex: "seg, 30 de março · 14:25"
    return `${date.replace('.', '')} · ${time}`;

  } catch {
    return new Date().toLocaleString('pt-BR');
  }
}

/* ════════════════════════════════════════════════
   API: BUSCAR CIDADES (Geocoding)
   ════════════════════════════════════════════════ */
async function searchCities(query) {
  if (!query || query.trim().length < 2) return [];

  const params = new URLSearchParams({
    name:     query.trim(),
    count:    6,
    language: 'pt',
    format:   'json',
  });

  try {
    const res = await fetch(`${GEO_URL}?${params}`);
    if (!res.ok) throw new Error(`Geocoding HTTP ${res.status}`);
    const data = await res.json();
    return data.results || [];
  } catch (err) {
    console.error('[Clima] searchCities:', err);
    return [];
  }
}

/* ════════════════════════════════════════════════
   API: BUSCAR CLIMA (Open-Meteo)
   ════════════════════════════════════════════════ */
async function fetchWeather(lat, lon) {
  const params = new URLSearchParams({
    latitude:  lat,
    longitude: lon,
    current: [
      'temperature_2m',
      'apparent_temperature',
      'relative_humidity_2m',
      'weather_code',
      'wind_speed_10m',
      'is_day',
    ].join(','),
    timezone:         'auto',
    wind_speed_unit:  'kmh',
  });

  try {
    const res = await fetch(`${WEATHER_URL}?${params}`);
    if (!res.ok) throw new Error(`Weather HTTP ${res.status}`);
    return await res.json();
    } catch (err) {
    console.error('[Clima] fetchWeather:', err);

    if (!navigator.onLine) {
      return { error: 'offline' };
    }

    return { error: 'api' };
  }
}

/* ════════════════════════════════════════════════
   UTILITÁRIO: DEBOUNCE
   ════════════════════════════════════════════════ */
function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/* ════════════════════════════════════════════════
   REFERÊNCIAS DO DOM
   ════════════════════════════════════════════════ */
const searchScreen    = document.getElementById('searchScreen');
const weatherScreen   = document.getElementById('weatherScreen');
const cityInput       = document.getElementById('cityInput');
const suggestionsList = document.getElementById('suggestionsList');
const loaderRing      = document.getElementById('loaderRing');
const backBtn         = document.getElementById('backBtn');

// Weather card elements
const elCityName     = document.getElementById('cityName');
const elCityRegion   = document.getElementById('cityRegion');
const elLocalTime    = document.getElementById('localTime');
const elWeatherIcon  = document.getElementById('weatherIcon');
const elTempValue    = document.getElementById('tempValue');
const elCondition    = document.getElementById('weatherCondition');
const elFeelsLike    = document.getElementById('feelsLike');
const elHumidity     = document.getElementById('humidity');
const elWindSpeed    = document.getElementById('windSpeed');

/* ════════════════════════════════════════════════
   RENDERIZAR SUGESTÕES
   ════════════════════════════════════════════════ */
function renderSuggestions(cities) {
  suggestionsList.innerHTML = '';

  if (!cities.length) {
    suggestionsList.innerHTML = `
      <li class="suggestion-item" style="cursor: default;">
        <span class="sug-name">Cidade não encontrada</span>
      </li>
    `;
    suggestionsList.classList.add('open');
    return;
  }

  cities.forEach(city => {
    const li = document.createElement('li');
    li.className = 'suggestion-item';
    li.setAttribute('role', 'option');
    li.setAttribute('tabindex', '0');

    // Monta o texto de região: Estado · País
    const region = [city.admin1, city.country].filter(Boolean).join(' · ');

    li.innerHTML = `
      <svg class="sug-pin" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" stroke-width="2"
           stroke-linecap="round" stroke-linejoin="round"
           aria-hidden="true">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
        <circle cx="12" cy="9" r="2.5"/>
      </svg>
      <span class="sug-name">${city.name}</span>
      <span class="sug-region">${region}</span>
    `;

    li.addEventListener('click', () => selectCity(city));
    li.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectCity(city);
      }
    });

    suggestionsList.appendChild(li);
  });

  suggestionsList.classList.add('open');
}

/* ════════════════════════════════════════════════
   SELECIONAR CIDADE → BUSCAR E EXIBIR CLIMA
   ════════════════════════════════════════════════ */
async function selectCity(city) {
  // Fecha sugestões e troca de tela
  suggestionsList.classList.remove('open');
  cityInput.value = '';

  searchScreen.classList.add('hidden');
  weatherScreen.classList.remove('hidden');

  // Mostra dados do lugar imediatamente (antes do fetch)
  elCityName.textContent   = city.name;
  const region             = [city.admin1, city.country].filter(Boolean).join(' · ');
  elCityRegion.textContent = region;
  elLocalTime.textContent  = '—';
  elTempValue.textContent  = '—';
  elCondition.textContent = 'Erro ao carregar clima.';
  elFeelsLike.textContent = 'Tente novamente mais tarde.';
  elHumidity.textContent   = '—';
  elWindSpeed.textContent  = '—';
  elWeatherIcon.className  = 'wi wi-na wc-weather-icon';

  // Busca os dados de clima
  const data = await fetchWeather(city.latitude, city.longitude);

  if (data?.error === 'offline') {
    elCondition.textContent = 'Sem conexão com a internet.';
    return;
  }

  if (data?.error === 'api') {
    elCondition.textContent = 'Erro na API de clima.';
    return;
  }

  if (!data || !data.current) {
    elCondition.textContent = 'Não foi possível carregar os dados.';
    elCondition.classList.add('error-msg');
    return;
  }

  const c      = data.current;
  const isDay  = c.is_day === 1;
  const code   = c.weather_code;
  const icon   = getWeatherIcon(code, isDay);
  const desc   = WMO_DESC[code] ?? 'Desconhecido';

  // Atualiza o DOM com os dados recebidos
  elWeatherIcon.className   = `wi ${icon} wc-weather-icon`;
  elTempValue.textContent   = Math.round(c.temperature_2m);
  elCondition.textContent   = desc;
  elFeelsLike.textContent   = `Sensação térmica ${Math.round(c.apparent_temperature)}°C`;
  elHumidity.textContent    = `${c.relative_humidity_2m}%`;
  elWindSpeed.textContent   = `${Math.round(c.wind_speed_10m)} km/h`;
  elLocalTime.textContent   = formatLocalTime(data.timezone);
}

/* ════════════════════════════════════════════════
   EVENT LISTENERS
   ════════════════════════════════════════════════ */

// Input com debounce
const handleInput = debounce(async (value) => {
  if (value.trim().length < 2) {
    renderSuggestions([]);
    return;
  }
  loaderRing.classList.add('active');
  const cities = await searchCities(value);
  loaderRing.classList.remove('active');
  renderSuggestions(cities);
}, DEBOUNCE_MS);

cityInput.addEventListener('input', e => handleInput(e.target.value));

// Fechar sugestões com Escape
cityInput.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    renderSuggestions([]);
    cityInput.blur();
  }
  // Navegar nas sugestões com seta para baixo
  if (e.key === 'ArrowDown') {
    const first = suggestionsList.querySelector('.suggestion-item');
    if (first) first.focus();
  }
});

// Fechar sugestões ao clicar fora
document.addEventListener('click', e => {
  if (!e.target.closest('.search-field')) {
    suggestionsList.classList.remove('open');
  }
});

// Botão voltar
backBtn.addEventListener('click', () => {
  weatherScreen.classList.add('hidden');
  searchScreen.classList.remove('hidden');
  cityInput.focus();
});

/* ════════════════════════════════════════════════
   INICIALIZAÇÃO
   ════════════════════════════════════════════════ */
applyTheme();

// Verifica o tema a cada minuto (para a virada de 06h ou 18h)
setInterval(applyTheme, 60_000);

module.exports = { fetchWeather, searchCities };
