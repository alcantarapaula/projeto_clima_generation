/* ════════════════════════════════════════════════
   CLIMA360 — API & Lógica da Aplicação
   Open-Meteo Geocoding + Weather APIs
   ════════════════════════════════════════════════ */

// ── Endpoints ─────────────────────────────────────
const GEO_URL     = 'https://geocoding-api.open-meteo.com/v1/search';
const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast';
const DEBOUNCE_MS = 340;

// ── Constantes reutilizáveis ──────────────────────
const MIN_QUERY_LENGTH = 2;

// ── Mapeamento WMO ───────────────────────────────
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
 * @returns {{error: string}}
 */
const handleFetchError = (context, err) => {
  console.error(`[Clima360] ${context}:`, err);
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { error: 'offline' };
  }
  return { error: 'api' };
};

// ── Ícones ───────────────────────────────────────
function getWeatherIcon(code, isDay) {
  if (code === 0)  return isDay ? 'wi-day-sunny'           : 'wi-night-clear';
  if (code <= 2)   return isDay ? 'wi-day-cloudy'          : 'wi-night-alt-partly-cloudy';
  if (code === 3)  return isDay ? 'wi-day-cloudy'          : 'wi-night-alt-cloudy';
  if (code <= 48)  return isDay ? 'wi-day-fog'             : 'wi-night-fog';
  if (code <= 57)  return isDay ? 'wi-day-sprinkle'        : 'wi-night-alt-sprinkle';
  if (code <= 65)  return isDay ? 'wi-day-rain'            : 'wi-night-alt-rain';
  if (code <= 67)  return isDay ? 'wi-day-rain-mix'        : 'wi-night-alt-rain-mix';
  if (code <= 77)  return isDay ? 'wi-day-snow'            : 'wi-night-alt-snow';
  if (code <= 82)  return isDay ? 'wi-day-showers'         : 'wi-night-alt-showers';
  if (code <= 86)  return isDay ? 'wi-day-snow-wind'       : 'wi-night-alt-snow-wind';
  if (code >= 95)  return isDay ? 'wi-day-thunderstorm'    : 'wi-night-alt-thunderstorm';
  return isDay ? 'wi-day-sunny' : 'wi-night-clear';
}

// ── Tema ─────────────────────────────────────────
/**
 * Aplica o tema dia/noite.
 *
 * @function applyTheme
 * @param {boolean|null} [cityIsDay=null]
 *   Quando fornecido (após busca de cidade), usa o campo is_day da API
 *   para respeitar o fuso horário local da cidade pesquisada.
 *   Quando null (tela de busca), usa o horário do dispositivo do usuário.
 */
function applyTheme(cityIsDay = null) {
  let mode;

  if (cityIsDay !== null) {
    // Fuso da cidade: usa is_day retornado pela Open-Meteo
    mode = cityIsDay ? 'day' : 'night';
  } else {
    // Tela de busca: usa o horário local do dispositivo
    const hour = new Date().getHours();
    mode = (hour >= 6 && hour < 18) ? 'day' : 'night';
  }

  document.documentElement.setAttribute('data-mode', mode);

  const brandIcon = document.getElementById('brandIcon');
  if (brandIcon) {
    brandIcon.className = mode === 'day'
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
 * @returns {Promise<Array<Object>>}
 */
async function searchCities(query) {
  if (!isValidQuery(query)) return [];

  try {
    const url = buildURL(GEO_URL, {
      name:     query.trim(),
      count:    6,
      language: 'pt',
      format:   'json',
    });

    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    return Array.isArray(data.results) ? data.results : [];
  } catch (err) {
    console.error('[Clima360] searchCities:', err);
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
 * @returns {Promise<Object>}
 */
async function fetchWeather(lat, lon) {
  try {
    const url = buildURL(WEATHER_URL, {
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
      daily: [
        'weather_code',
        'temperature_2m_max',
        'temperature_2m_min',
      ].join(','),
      forecast_days:   6,   // hoje (índice 0) + 5 dias
      timezone:        'auto',
      wind_speed_unit: 'kmh',
    });

    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();

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
 * @returns {Function}
 */
function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/* ════════════════════════════════════════════════
   WEATHER ANIMATION ENGINE
   Canvas de partículas para retratar o clima
   ════════════════════════════════════════════════ */

const canvas = document.getElementById('weatherCanvas');
const ctx    = canvas ? canvas.getContext('2d') : null;

let animFrame     = null;
let lightningTimer = null;
let particles     = [];

/** Redimensiona o canvas para cobrir a tela inteira */
function resizeCanvas() {
  if (!canvas) return;
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
}

/** Para e limpa a animação atual */
function stopAnimation() {
  if (animFrame)      { cancelAnimationFrame(animFrame); animFrame = null; }
  if (lightningTimer) { clearTimeout(lightningTimer);    lightningTimer = null; }
  particles = [];
  if (canvas) {
    canvas.classList.remove('active');
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

/**
 * Mapeia o código WMO + is_day para um tipo de animação.
 *
 * @param {number} code  - Código WMO
 * @param {boolean} isDay
 * @returns {string} weatherType
 */
function getWeatherType(code, isDay) {
  if (code === 0 || code === 1)  return isDay ? 'clear-day' : 'clear-night';
  if (code <= 3)                 return 'cloudy';
  if (code <= 48)                return 'fog';
  if (code <= 57)                return 'drizzle';
  if (code <= 82)                return 'rain';
  if (code <= 86)                return 'snow';
  if (code >= 95)                return 'storm';
  return 'none';
}

/**
 * Inicia a animação de clima adequada.
 *
 * @param {number} code  - Código WMO
 * @param {boolean} isDay
 */
function startWeatherAnimation(code, isDay) {
  if (!canvas || !ctx) return;
  stopAnimation();
  resizeCanvas();

  const type = getWeatherType(code, isDay);

  switch (type) {
    case 'drizzle':    initRain(28,  false); break;
    case 'rain':       initRain(80,  false); break;
    case 'storm':      initRain(150, true);  break;
    case 'snow':       initSnow(65);         break;
    case 'fog':        initFog(14);          break;
    case 'clear-day':  initSunRays();        break;
    case 'clear-night':initStars(140);       break;
    case 'cloudy':     /* efeito sutil via orbs, sem canvas */ return;
    default:           return;
  }

  canvas.classList.add('active');
}

// ── Chuva ─────────────────────────────────────────
function initRain(count, isStorm) {
  for (let i = 0; i < count; i++) {
    particles.push({
      x:       Math.random() * (canvas.width + 150) - 75,
      y:       Math.random() * canvas.height,
      len:     isStorm ? 22 + Math.random() * 18 : 14 + Math.random() * 14,
      speed:   isStorm ? 22 + Math.random() * 12  : 10 + Math.random() * 8,
      opacity: 0.20 + Math.random() * 0.35,
      width:   isStorm ? 1.4 : 0.7,
    });
  }

  if (isStorm) scheduleLightning();

  const style = getComputedStyle(document.documentElement);
  const color = style.getPropertyValue('--rain-color').trim() || 'rgba(160,200,255,0.45)';

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = color;
    ctx.lineCap     = 'round';

    for (const p of particles) {
      ctx.globalAlpha = p.opacity;
      ctx.lineWidth   = p.width;
      ctx.beginPath();
      // leve inclinação para simular vento
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.len * 0.22, p.y + p.len);
      ctx.stroke();

      p.y += p.speed;
      p.x -= p.speed * 0.12;

      if (p.y > canvas.height + p.len) {
        p.y = -p.len;
        p.x = Math.random() * (canvas.width + 150) - 75;
      }
    }

    ctx.globalAlpha = 1;
    animFrame = requestAnimationFrame(draw);
  }

  draw();
}

// ── Neve ──────────────────────────────────────────
function initSnow(count) {
  for (let i = 0; i < count; i++) {
    particles.push({
      x:      Math.random() * canvas.width,
      y:      Math.random() * canvas.height,
      r:      1.5 + Math.random() * 3.5,
      speedY: 0.4 + Math.random() * 1.2,
      speedX: -0.4 + Math.random() * 0.8,
      opacity: 0.5 + Math.random() * 0.4,
      drift:  Math.random() * Math.PI * 2,
    });
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const p of particles) {
      p.drift += 0.018;
      ctx.globalAlpha = p.opacity;
      ctx.fillStyle   = 'rgba(230, 240, 255, 1)';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();

      p.x += p.speedX + Math.sin(p.drift) * 0.45;
      p.y += p.speedY;

      if (p.y > canvas.height + 10) {
        p.y = -10;
        p.x = Math.random() * canvas.width;
      }
    }

    ctx.globalAlpha = 1;
    animFrame = requestAnimationFrame(draw);
  }

  draw();
}

// ── Nevoeiro ──────────────────────────────────────
function initFog(count) {
  for (let i = 0; i < count; i++) {
    particles.push({
      x:       Math.random() * canvas.width,
      y:       60 + Math.random() * (canvas.height - 120),
      r:       90 + Math.random() * 130,
      speedX:  0.18 + Math.random() * 0.32,
      opacity: 0.035 + Math.random() * 0.055,
    });
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const p of particles) {
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
      grad.addColorStop(0, `rgba(200, 215, 230, ${p.opacity})`);
      grad.addColorStop(1,  'rgba(200, 215, 230, 0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();

      p.x += p.speedX;
      if (p.x - p.r > canvas.width) {
        p.x = -p.r;
        p.y = 60 + Math.random() * (canvas.height - 120);
      }
    }

    animFrame = requestAnimationFrame(draw);
  }

  draw();
}

// ── Céu limpo — Noite (estrelas cintilantes) ───────
function initStars(count) {
  for (let i = 0; i < count; i++) {
    particles.push({
      x:            Math.random() * canvas.width,
      y:            Math.random() * canvas.height * 0.75,
      r:            0.4 + Math.random() * 1.6,
      opacity:      0.3 + Math.random() * 0.65,
      twinkleSpeed: 0.008 + Math.random() * 0.025,
      phase:        Math.random() * Math.PI * 2,
    });
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const p of particles) {
      p.phase += p.twinkleSpeed;
      const alpha = p.opacity * (0.45 + 0.55 * Math.sin(p.phase));

      ctx.globalAlpha = alpha;
      ctx.fillStyle   = 'rgba(220, 235, 255, 1)';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
    animFrame = requestAnimationFrame(draw);
  }

  draw();
}

// ── Céu limpo — Dia (raios de luz suaves) ──────────
function initSunRays() {
  let phase = 0;
  const RAY_COUNT = 9;

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    phase += 0.004;

    // Raios saem do canto superior direito
    const originX = canvas.width  * 0.88;
    const originY = canvas.height * -0.05;
    const rayLen  = canvas.height * 1.8;
    const spread  = 0.025;

    for (let i = 0; i < RAY_COUNT; i++) {
      // Distribui os raios em arco de ~100 graus voltados para baixo-esquerda
      const baseAngle = (Math.PI * 0.55) + (i / (RAY_COUNT - 1)) * (Math.PI * 0.55);
      const alpha     = (0.04 + 0.025 * Math.sin(phase + i * 0.65));

      ctx.globalAlpha = alpha;
      ctx.fillStyle   = 'rgba(255, 220, 100, 1)';
      ctx.beginPath();
      ctx.moveTo(originX, originY);
      ctx.lineTo(
        originX + Math.cos(baseAngle - spread) * rayLen,
        originY + Math.sin(baseAngle - spread) * rayLen
      );
      ctx.lineTo(
        originX + Math.cos(baseAngle + spread) * rayLen,
        originY + Math.sin(baseAngle + spread) * rayLen
      );
      ctx.closePath();
      ctx.fill();
    }

    ctx.globalAlpha = 1;
    animFrame = requestAnimationFrame(draw);
  }

  draw();
}

// ── Relâmpagos (tempestade) ────────────────────────
function scheduleLightning() {
  const delay = 2800 + Math.random() * 6500;
  lightningTimer = setTimeout(() => {
    triggerLightning();
    scheduleLightning();
  }, delay);
}

function triggerLightning() {
  // Flash duplo rápido no body (veja keyframe 'lightning-strike' no CSS)
  document.body.classList.add('lightning-flash');
  setTimeout(() => document.body.classList.remove('lightning-flash'), 450);
}

// Redimensiona o canvas junto com a janela
window.addEventListener('resize', () => {
  if (canvas && canvas.classList.contains('active')) {
    resizeCanvas();
  }
});

/* ════════════════════════════════════════════════
   FORECAST RENDERER
   Recebe data.daily e preenche a lista de 5 dias
   ════════════════════════════════════════════════ */

/**
 * Formata um nome de dia da semana e uma data curta a partir de uma string ISO.
 *
 * @param {string} isoDate  - Ex: "2025-11-03"
 * @param {string} timezone - Fuso horário da cidade
 * @returns {{ weekday: string, date: string }}
 */
function parseDayLabel(isoDate, timezone) {
  // Adiciona T12:00 para evitar problemas de fuso que moveriam a data para o dia anterior
  const d = new Date(`${isoDate}T12:00:00`);

  const weekday = new Intl.DateTimeFormat('pt-BR', {
    timeZone: timezone,
    weekday: 'long',
  }).format(d);

  const date = new Intl.DateTimeFormat('pt-BR', {
    timeZone: timezone,
    day:   'numeric',
    month: 'long',
  }).format(d);

  // Capitaliza primeira letra do dia da semana
  return {
    weekday: weekday.charAt(0).toUpperCase() + weekday.slice(1),
    date,
  };
}

/**
 * Renderiza a lista de previsão para os próximos 5 dias (índices 1–5 de data.daily).
 *
 * @param {Object} daily    - data.daily da Open-Meteo
 * @param {string} timezone - Fuso horário da cidade (data.timezone)
 */
function renderForecast(daily, timezone) {
  const list = document.getElementById('forecastList');
  if (!list || !daily) return;

  list.innerHTML = '';

  // Índice 0 = hoje → começa em 1
  const DAYS = 5;
  const total = Math.min(daily.time.length - 1, DAYS);

  for (let i = 1; i <= total; i++) {
    const code    = daily.weather_code[i];
    const maxTemp = Math.round(daily.temperature_2m_max[i]);
    const minTemp = Math.round(daily.temperature_2m_min[i]);
    const { weekday, date } = parseDayLabel(daily.time[i], timezone);

    // Ícones usam is_day = true (previsão diária sempre apresentada como dia)
    const iconClass = getWeatherIcon(code, true);
    const desc      = WMO_DESC[code] ?? 'Desconhecido';

    const li = document.createElement('li');
    li.className = 'forecast-row';
    li.setAttribute('role', 'listitem');
    // delay escalonado para a animação de entrada
    li.style.animationDelay = `${(i - 1) * 60}ms`;

    li.innerHTML = `
      <div class="fc-day">
        <span class="fc-weekday">${escapeHTML(weekday)}</span>
        <span class="fc-date">${escapeHTML(date)}</span>
      </div>
      <div class="fc-condition">
        <i class="wi ${escapeHTML(iconClass)} fc-icon" aria-hidden="true"></i>
        <span class="fc-desc">${escapeHTML(desc)}</span>
      </div>
      <div class="fc-temp">
        <span class="fc-arrow up"  aria-hidden="true"></span>
        <span class="fc-temp-val max" aria-label="Máxima">${maxTemp}°</span>
      </div>
      <div class="fc-temp">
        <span class="fc-arrow down" aria-hidden="true"></span>
        <span class="fc-temp-val min" aria-label="Mínima">${minTemp}°</span>
      </div>
    `;

    list.appendChild(li);
  }
}

/* ════════════════════════════════════════════════
   DOM
   ════════════════════════════════════════════════ */
const getEl = (id) => document.getElementById(id);

const searchScreen    = getEl('searchScreen');
const weatherScreen   = getEl('weatherScreen');
const cityInput       = getEl('cityInput');
const suggestionsList = getEl('suggestionsList');
const loaderRing      = getEl('loaderRing');
const backBtn         = getEl('backBtn');

const elCityName    = getEl('cityName');
const elCityRegion  = getEl('cityRegion');
const elLocalTime   = getEl('localTime');
const elWeatherIcon = getEl('weatherIcon');
const elTempValue   = getEl('tempValue');
const elCondition   = getEl('weatherCondition');
const elFeelsLike   = getEl('feelsLike');
const elHumidity    = getEl('humidity');
const elWindSpeed   = getEl('windSpeed');

// ── UI helpers ───────────────────────────────────
const setLoading = (state) =>
  loaderRing?.classList[state ? 'add' : 'remove']('active');

const clearSuggestions = () => {
  suggestionsList.innerHTML = '';
  suggestionsList.classList.remove('open');
};

/**
 * Escapa caracteres HTML especiais para prevenir XSS.
 * Deve ser aplicada em todo dado externo (API) antes de
 * injetar em innerHTML.
 *
 * @param {string} str - String bruta da API
 * @returns {string} String segura para uso em HTML
 */
function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

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

    // escapeHTML em todos os campos vindos da API antes de usar em innerHTML
    const region = [city.admin1, city.country]
      .filter(Boolean)
      .map(escapeHTML)
      .join(' · ');

    li.className = 'suggestion-item';
    li.innerHTML = `
      <span class="sug-name">${escapeHTML(city.name)}</span>
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

  elCityName.textContent   = city.name;
  elCityRegion.textContent = [city.admin1, city.country].filter(Boolean).join(' · ');
  elLocalTime.textContent  = '—';
  elCondition.textContent  = 'Carregando...';
  elTempValue.textContent  = '—';
  elFeelsLike.textContent  = '';
  elHumidity.textContent   = '—';
  elWindSpeed.textContent  = '—';
  elWeatherIcon.className  = 'wi wi-na wc-weather-icon';

  stopAnimation(); // limpa animação anterior

  const data = await fetchWeather(city.latitude, city.longitude);

  if (data.error) {
    elCondition.textContent = data.error === 'offline'
      ? 'Sem conexão com a internet.'
      : 'Erro ao carregar clima.';
    return;
  }

  const c     = data.current;
  const isDay = c.is_day === 1;

  // ── Atualiza o tema conforme o fuso horário da cidade ──
  applyTheme(isDay);

  // ── Preenche os dados ──────────────────────────────────
  elTempValue.textContent   = Math.round(c.temperature_2m);
  elCondition.textContent   = WMO_DESC[c.weather_code] || 'Desconhecido';
  elFeelsLike.textContent   = `Sensação térmica ${Math.round(c.apparent_temperature)}°C`;
  elHumidity.textContent    = `${c.relative_humidity_2m}%`;
  elWindSpeed.textContent   = `${Math.round(c.wind_speed_10m)} km/h`;
  elLocalTime.textContent   = formatLocalTime(data.timezone);
  elWeatherIcon.className   = `wi ${getWeatherIcon(c.weather_code, isDay)} wc-weather-icon`;

  // ── Inicia animação de clima ───────────────────────────
  startWeatherAnimation(c.weather_code, isDay);

  // ── Renderiza previsão dos próximos 5 dias ─────────────
  renderForecast(data.daily, data.timezone);
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

cityInput?.addEventListener('input', (e) => handleInput(e.target.value));

backBtn?.addEventListener('click', () => {
  weatherScreen.classList.add('hidden');
  searchScreen.classList.remove('hidden');
  stopAnimation();
  applyTheme(); // restaura tema pelo horário local ao voltar para busca
});

// ── Inicialização ────────────────────────────────
if (typeof document !== 'undefined') {
  applyTheme();
  // Reavalia tema na tela de busca a cada minuto (virada de 6h ou 18h)
  setInterval(() => {
    if (!weatherScreen.classList.contains('hidden')) return;
    applyTheme();
  }, 60_000);
}

// ── Modal de Privacidade ─────────────────────────
const privacyBtn   = document.getElementById('privacyBtn');
const privacyModal = document.getElementById('privacyModal');
const closePrivacy = document.getElementById('closePrivacy');

privacyBtn?.addEventListener('click', (e) => {
  e.preventDefault();
  privacyModal?.classList.remove('hidden');
});

closePrivacy?.addEventListener('click', () => {
  privacyModal?.classList.add('hidden');
});

// Fecha ao clicar fora do conteúdo do modal
privacyModal?.addEventListener('click', (e) => {
  if (e.target === privacyModal) privacyModal.classList.add('hidden');
});

// ── Export ────────────────────────────────────────
if (typeof module !== 'undefined') {
  module.exports = { fetchWeather, searchCities };
}
