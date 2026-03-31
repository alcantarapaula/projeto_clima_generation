/* ════════════════════════════════════════════════
   CLIMA360 — API & Lógica da Aplicação (Refatorado)
   Open-Meteo Geocoding + Weather APIs
   ════════════════════════════════════════════════ */

/**
 * @typedef {Object} CONFIG
 * @property {string} GEO_URL - URL da API de geocodificação.
 * @property {string} WEATHER_URL - URL da API de previsão do tempo.
 * @property {number} DEBOUNCE_MS - Tempo de atraso do debounce em milissegundos.
 * @property {number} MIN_QUERY_LENGTH - Tamanho mínimo da string de busca.
 * @property {number} FORECAST_DAYS - Quantidade de dias para exibir na previsão.
 */
const CONFIG = {
  GEO_URL: 'https://geocoding-api.open-meteo.com/v1/search',
  WEATHER_URL: 'https://api.open-meteo.com/v1/forecast',
  DEBOUNCE_MS: 340,
  MIN_QUERY_LENGTH: 2,
  FORECAST_DAYS: 5,
};

// ── Mapeamento WMO ───────────────────────────────
const WMO_DESC = {
  0: 'Céu limpo', 1: 'Principalmente limpo', 2: 'Parcialmente nublado', 3: 'Nublado',
  45: 'Nevoeiro', 48: 'Nevoeiro com geada', 51: 'Garoa leve', 53: 'Garoa moderada',
  55: 'Garoa intensa', 56: 'Garoa congelante leve', 57: 'Garoa congelante intensa',
  61: 'Chuva leve', 63: 'Chuva moderada', 65: 'Chuva forte', 66: 'Chuva congelante leve',
  67: 'Chuva congelante intensa', 71: 'Neve leve', 73: 'Neve moderada', 75: 'Neve forte',
  77: 'Granizo de neve', 80: 'Pancadas de chuva leves', 81: 'Pancadas de chuva moderadas',
  82: 'Pancadas de chuva fortes', 85: 'Pancadas de neve leves', 86: 'Pancadas de neve fortes',
  95: 'Tempestade', 96: 'Tempestade com granizo leve', 99: 'Tempestade com granizo forte',
};

// ── Service: Abstração de API ────────────────────
const WeatherService = {
  /**
   * Faz uma requisição HTTP para a API especificada.
   * * @param {string} baseUrl - A URL base da API a ser chamada.
   * @param {Object} params - Objeto contendo os parâmetros da query string a serem enviados.
   * @returns {Promise<Object>} Uma promise que resolve com o JSON da resposta ou com um objeto de erro { error: 'api' | 'offline' }.
   * @throws {Error} Lança internamente um erro se o status da resposta não for ok (tratado no bloco catch).
   * * @example
   * const params = { latitude: -22.9, longitude: -43.2 };
   * const data = await WeatherService.request('https://api.open-meteo.com/v1/forecast', params);
   */
  async request(baseUrl, params) {
    const url = `${baseUrl}?${new URLSearchParams(params)}`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.error(`[Clima360] Erro em ${baseUrl}:`, err);
      return { error: !navigator.onLine ? 'offline' : 'api' };
    }
  }
};

// ── Helpers de UI & Formatação ───────────────────
const formatters = {
  /**
   * Formata a data e hora local de uma cidade baseada no seu fuso horário.
   * * @param {string} timezone - O fuso horário válido no formato IANA (ex: 'America/Sao_Paulo').
   * @returns {string} String formatada com a data e hora local (ex: '3 de nov · 15:30').
   * * @example
   * const timeStr = formatters.localTime('America/New_York');
   */
  localTime(timezone) {
    try {
      const now = new Date();
      const options = { timeZone: timezone, hour: '2-digit', minute: '2-digit' };
      const dateOptions = { timeZone: timezone, weekday: 'short', day: 'numeric', month: 'long' };
      
      const time = new Intl.DateTimeFormat('pt-BR', options).format(now);
      const date = new Intl.DateTimeFormat('pt-BR', dateOptions).format(now);
      
      return `${date.replace('.', '')} · ${time}`;
    } catch {
      return new Date().toLocaleString('pt-BR');
    }
  },

  /**
   * Converte uma data ISO em rótulos amigáveis (dia da semana e dia/mês) garantindo o fuso correto.
   * * @param {string} isoDate - A data no formato 'YYYY-MM-DD'.
   * @param {string} timezone - O fuso horário no formato IANA.
   * @returns {{weekday: string, date: string}} Objeto contendo o dia da semana formatado e a data.
   * @throws {RangeError} Lança um RangeError caso o fuso horário (timezone) informado seja inválido para o Intl.DateTimeFormat.
   * * @example
   * const label = formatters.parseDayLabel('2025-11-03', 'America/Sao_Paulo');
   * // Retorna: { weekday: 'Segunda-feira', date: '3 de novembro' }
   */
  parseDayLabel(isoDate, timezone) {
    const d = new Date(`${isoDate}T12:00:00`);
    const locale = 'pt-BR';
    const opt = { timeZone: timezone };

    const weekday = new Intl.DateTimeFormat(locale, { ...opt, weekday: 'long' }).format(d);
    const date = new Intl.DateTimeFormat(locale, { ...opt, day: 'numeric', month: 'long' }).format(d);

    return {
      weekday: weekday.charAt(0).toUpperCase() + weekday.slice(1),
      date
    };
  }
};

// ── Gerenciador de Tema ──────────────────────────
/**
 * Aplica o tema visual (claro/escuro) no documento baseando-se no indicador se é dia ou noite na localidade selecionada,
 * ou utilizando o horário local do usuário como padrão.
 * * @param {boolean|number|null} [cityIsDay=null] - Indicador de período. 1/true para dia, 0/false para noite. Se omitido/null, avalia a hora da máquina local.
 * @returns {void}
 * * @example
 * applyTheme(1); // Aplica o tema "day"
 * applyTheme();  // Aplica tema automático dependendo da hora local do navegador
 */
function applyTheme(cityIsDay = null) {
  const isDay = cityIsDay !== null 
    ? cityIsDay === 1 || cityIsDay === true
    : (new Date().getHours() >= 6 && new Date().getHours() < 18);

  const mode = isDay ? 'day' : 'night';
  document.documentElement.setAttribute('data-mode', mode);

  const brandIcon = document.getElementById('brandIcon');
  if (brandIcon) {
    brandIcon.className = `wi wi-${isDay ? 'day-sunny' : 'night-clear'} brand-icon`;
  }
}

// ── Ícones ───────────────────────────────────────
/**
 * Seleciona a classe CSS apropriada para a biblioteca Weather Icons com base no código WMO.
 * * @param {number} code - O código WMO representando a condição climática.
 * @param {boolean|number} isDay - Indicador se a condição ocorre durante o dia (true/1) ou noite (false/0).
 * @returns {string} O nome da classe do ícone para uso na UI (ex: 'wi-day-cloudy').
 * * @example
 * const icon = getWeatherIcon(3, true); // Retorna 'wi-day-cloudy'
 */
function getWeatherIcon(code, isDay) {
  const icons = {
    0: isDay ? 'wi-day-sunny' : 'wi-night-clear',
    2: isDay ? 'wi-day-cloudy' : 'wi-night-alt-partly-cloudy',
    3: isDay ? 'wi-day-cloudy' : 'wi-night-alt-cloudy',
    48: isDay ? 'wi-day-fog' : 'wi-night-fog',
    57: isDay ? 'wi-day-sprinkle' : 'wi-night-alt-sprinkle',
    65: isDay ? 'wi-day-rain' : 'wi-night-alt-rain',
    67: isDay ? 'wi-day-rain-mix' : 'wi-night-alt-rain-mix',
    77: isDay ? 'wi-day-snow' : 'wi-night-alt-snow',
    82: isDay ? 'wi-day-showers' : 'wi-night-alt-showers',
    86: isDay ? 'wi-day-snow-wind' : 'wi-night-alt-snow-wind',
    95: isDay ? 'wi-day-thunderstorm' : 'wi-night-alt-thunderstorm',
  };

  const key = Object.keys(icons).find(k => code <= k) || 0;
  return icons[key];
}

/* ════════════════════════════════════════════════
   WEATHER ANIMATION ENGINE
   ════════════════════════════════════════════════ */
/**
 * Objeto responsável por gerenciar e renderizar as animações climáticas de fundo (chuva, neve, estrelas, etc) em um Canvas HTML5.
 */
const AnimationEngine = {
  canvas: document.getElementById('weatherCanvas'),
  ctx: document.getElementById('weatherCanvas')?.getContext('2d'),
  frameId: null,
  timer: null,
  particles: [],

  /**
   * Para a animação atual e limpa o contexto e arrays do canvas.
   * @returns {void}
   */
  stop() {
    if (this.frameId) cancelAnimationFrame(this.frameId);
    if (this.timer) clearTimeout(this.timer);
    this.particles = [];
    if (this.canvas) {
      this.canvas.classList.remove('active');
      this.ctx?.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  },

  /**
   * Redimensiona o canvas para acompanhar a resolução da janela atual.
   * @returns {void}
   */
  resize() {
    if (this.canvas) {
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
    }
  },

  /**
   * Inicia a animação de fundo correspondente à condição climática reportada.
   * * @param {number} code - O código climático atual WMO.
   * @param {boolean|number} isDay - Indicador se é dia ou não, para alternar tipos (ex: sol radiante x estrelas).
   * @returns {void}
   * * @example
   * AnimationEngine.start(95, false); // Inicia animação de tempestade noturna
   */
  start(code, isDay) {
    if (!this.canvas || !this.ctx) return;
    this.stop();
    this.resize();

    const type = this.getType(code, isDay);
    const renderers = {
      drizzle: () => this.initRain(28, false),
      rain:    () => this.initRain(80, false),
      storm:   () => this.initRain(150, true),
      snow:    () => this.initSnow(65),
      fog:     () => this.initFog(14),
      'clear-day':   () => this.initSunRays(),
      'clear-night': () => this.initStars(140),
    };

    if (renderers[type]) {
      renderers[type]();
      this.canvas.classList.add('active');
    }
  },

  getType(code, isDay) {
    if (code <= 1) return isDay ? 'clear-day' : 'clear-night';
    if (code <= 3) return 'cloudy';
    if (code <= 48) return 'fog';
    if (code <= 57) return 'drizzle';
    if (code <= 82) return 'rain';
    if (code <= 86) return 'snow';
    return 'storm';
  },

  // Exemplo de Rain refatorado (os outros seguem lógica similar)
  initRain(count, isStorm) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: Math.random() * (this.canvas.width + 150) - 75,
        y: Math.random() * this.canvas.height,
        len: isStorm ? 22 + Math.random() * 18 : 14 + Math.random() * 14,
        speed: isStorm ? 22 + Math.random() * 12 : 10 + Math.random() * 8,
        opacity: 0.20 + Math.random() * 0.35,
        width: isStorm ? 1.4 : 0.7,
      });
    }
    if (isStorm) this.scheduleLightning();
    this.loop(() => this.drawRain());
  },

  scheduleLightning() {
    this.timer = setTimeout(() => {
      document.body.classList.add('lightning-flash');
      setTimeout(() => document.body.classList.remove('lightning-flash'), 450);
      this.scheduleLightning();
    }, 2800 + Math.random() * 6500);
  },

  drawRain() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.strokeStyle = 'rgba(160,200,255,0.45)';
    this.ctx.lineCap = 'round';

    this.particles.forEach(p => {
      this.ctx.globalAlpha = p.opacity;
      this.ctx.lineWidth = p.width;
      this.ctx.beginPath();
      this.ctx.moveTo(p.x, p.y);
      this.ctx.lineTo(p.x - p.len * 0.22, p.y + p.len);
      this.ctx.stroke();

      p.y += p.speed;
      p.x -= p.speed * 0.12;
      if (p.y > this.canvas.height + p.len) {
        p.y = -p.len;
        p.x = Math.random() * (this.canvas.width + 150) - 75;
      }
    });
  },

  // Métodos simplificados para Snow, Stars, etc. (mantendo a lógica original)
  initSnow(count) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: Math.random() * this.canvas.width, y: Math.random() * this.canvas.height,
        r: 1.5 + Math.random() * 3.5, speedY: 0.4 + Math.random() * 1.2,
        drift: Math.random() * Math.PI * 2, opacity: 0.5 + Math.random() * 0.4
      });
    }
    this.loop(() => {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.particles.forEach(p => {
        p.drift += 0.018;
        this.ctx.globalAlpha = p.opacity;
        this.ctx.fillStyle = 'white';
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        this.ctx.fill();
        p.y += p.speedY;
        p.x += Math.sin(p.drift) * 0.45;
        if (p.y > this.canvas.height) p.y = -10;
      });
    });
  },

  initStars(count) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: Math.random() * this.canvas.width, y: Math.random() * this.canvas.height * 0.7,
        r: 0.4 + Math.random() * 1.6, phase: Math.random() * Math.PI * 2,
        speed: 0.01 + Math.random() * 0.02
      });
    }
    this.loop(() => {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.particles.forEach(p => {
        p.phase += p.speed;
        this.ctx.globalAlpha = 0.3 + 0.7 * Math.abs(Math.sin(p.phase));
        this.ctx.fillStyle = '#ebf3ff';
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        this.ctx.fill();
      });
    });
  },

  initSunRays() {
    let phase = 0;
    this.loop(() => {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      phase += 0.004;
      for (let i = 0; i < 9; i++) {
        const angle = (Math.PI * 0.55) + (i / 8) * (Math.PI * 0.55);
        this.ctx.globalAlpha = 0.04 + 0.02 * Math.sin(phase + i);
        this.ctx.fillStyle = '#ffdc64';
        this.ctx.beginPath();
        this.ctx.moveTo(this.canvas.width * 0.88, -20);
        this.ctx.lineTo(this.canvas.width * 0.88 + Math.cos(angle - 0.02) * 2000, Math.sin(angle - 0.02) * 2000);
        this.ctx.lineTo(this.canvas.width * 0.88 + Math.cos(angle + 0.02) * 2000, Math.sin(angle + 0.02) * 2000);
        this.ctx.fill();
      }
    });
  },

  initFog(count) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: Math.random() * this.canvas.width, y: 100 + Math.random() * (this.canvas.height - 200),
        r: 100 + Math.random() * 150, speed: 0.2 + Math.random() * 0.3, opacity: 0.04 + Math.random() * 0.05
      });
    }
    this.loop(() => {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.particles.forEach(p => {
        const g = this.ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
        g.addColorStop(0, `rgba(200, 220, 240, ${p.opacity})`);
        g.addColorStop(1, 'transparent');
        this.ctx.fillStyle = g;
        this.ctx.beginPath(); this.ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); this.ctx.fill();
        p.x += p.speed;
        if (p.x - p.r > this.canvas.width) p.x = -p.r;
      });
    });
  },

  /**
   * Wrapper utilitário que lida com o RequestAnimationFrame para alimentar os laços de renderização de forma limpa.
   * * @param {Function} callback - A função de desenho que será executada a cada frame de tela.
   * @returns {void}
   */
  loop(callback) {
    const internalLoop = () => {
      callback();
      this.frameId = requestAnimationFrame(internalLoop);
    };
    internalLoop();
  }
};

// ── Renderização da Previsão ─────────────────────
/**
 * Pega os dados brutos de previsão diária (da API) e renderiza na lista de DOM correspondente.
 * * @param {Object} daily - Objeto contendo arrays sincronizados (time, weather_code, etc).
 * @param {string} timezone - O fuso horário para alinhar as datas de previsão.
 * @returns {void}
 * * @example
 * renderForecast(data.daily, 'America/Sao_Paulo');
 */
function renderForecast(daily, timezone) {
  const list = document.getElementById('forecastList');
  if (!list || !daily) return;

  list.innerHTML = daily.time
    .slice(1, CONFIG.FORECAST_DAYS + 1)
    .map((time, i) => {
      const index = i + 1;
      const code = daily.weather_code[index];
      const { weekday, date } = formatters.parseDayLabel(time, timezone);
      const iconClass = getWeatherIcon(code, true);

      return `
        <li class="forecast-row" role="listitem" style="animation-delay: ${i * 60}ms">
          <div class="fc-day">
            <span class="fc-weekday">${weekday}</span>
            <span class="fc-date">${date}</span>
          </div>
          <div class="fc-condition">
            <i class="wi ${iconClass} fc-icon" aria-hidden="true"></i>
            <span class="fc-desc">${WMO_DESC[code] || '—'}</span>
          </div>
          <div class="fc-temp">
            <span class="fc-arrow up"></span>
            <span class="fc-temp-val max">${Math.round(daily.temperature_2m_max[index])}°</span>
          </div>
          <div class="fc-temp">
            <span class="fc-arrow down"></span>
            <span class="fc-temp-val min">${Math.round(daily.temperature_2m_min[index])}°</span>
          </div>
        </li>
      `;
    }).join('');
}

// ── Lógica Principal da UI ───────────────────────
const UI = {
  elements: {
    searchScreen:    document.getElementById('searchScreen'),
    weatherScreen:   document.getElementById('weatherScreen'),
    cityInput:       document.getElementById('cityInput'),
    suggestionsList: document.getElementById('suggestionsList'),
    loader:          document.getElementById('loaderRing'),
    backBtn:         document.getElementById('backBtn'),
    // Dados do Clima
    cityName:        document.getElementById('cityName'),
    cityRegion:      document.getElementById('cityRegion'),
    localTime:       document.getElementById('localTime'),
    tempValue:       document.getElementById('tempValue'),
    condition:       document.getElementById('weatherCondition'),
    icon:            document.getElementById('weatherIcon'),
    humidity:        document.getElementById('humidity'),
    wind:            document.getElementById('windSpeed'),
    feels:           document.getElementById('feelsLike'),
  },

  /**
   * Controla a visibilidade do indicador de carregamento do app.
   * * @param {boolean} active - Passar 'true' exibe o loader, 'false' o oculta.
   * @returns {void}
   */
  setLoading(active) {
    this.elements.loader?.classList[active ? 'add' : 'remove']('active');
  },

  /**
   * Processa o input de texto, aciona a API de geocodificação para buscar cidades e repassa para a renderização de sugestões.
   * * @param {string} query - O texto (nome da cidade) sendo pesquisado.
   * @returns {Promise<void>}
   * * @example
   * await UI.handleSearch('Rio de Janeiro');
   */
  async handleSearch(query) {
    if (query.trim().length < CONFIG.MIN_QUERY_LENGTH) {
      this.elements.suggestionsList.classList.remove('open');
      return;
    }

    this.setLoading(true);
    const data = await WeatherService.request(CONFIG.GEO_URL, {
      name: query.trim(), count: 6, language: 'pt', format: 'json'
    });
    this.setLoading(false);

    this.renderSuggestions(data.results || []);
  },

  /**
   * Injeta no DOM a listagem de cidades retornadas na busca.
   * * @param {Array<Object>} cities - A lista (array) de cidades extraídas da Geocoding API.
   * @returns {void}
   */
  renderSuggestions(cities) {
    const list = this.elements.suggestionsList;
    list.innerHTML = cities.length 
      ? cities.map(city => `
          <li class="suggestion-item" data-lat="${city.latitude}" data-lon="${city.longitude}" data-name="${city.name}" data-admin="${city.admin1 || ''}" data-country="${city.country}">
            <span class="sug-name">${city.name}</span>
            <span class="sug-region">${[city.admin1, city.country].filter(Boolean).join(' · ')}</span>
          </li>
        `).join('')
      : '<li class="suggestion-item"><span class="sug-name">Cidade não encontrada</span></li>';

    list.classList.add('open');

    // Listener de clique delegado para performance
    list.querySelectorAll('.suggestion-item').forEach(item => {
      if(item.dataset.lat) {
        item.onclick = () => this.selectCity({
          name: item.dataset.name,
          latitude: item.dataset.lat,
          longitude: item.dataset.lon,
          admin1: item.dataset.admin,
          country: item.dataset.country
        });
      }
    });
  },

  /**
   * Manipula a lógica do momento em que um usuário clica e escolhe uma das cidades nas sugestões, buscando os dados da previsão climática e montando a tela inteira.
   * * @param {Object} city - Dados da cidade clicada contendo coordenadas e metadados.
   * @returns {Promise<void>}
   * * @example
   * await UI.selectCity({ name: 'São Paulo', latitude: -23.55, longitude: -46.63 });
   */
  async selectCity(city) {
    this.elements.suggestionsList.classList.remove('open');
    this.elements.cityInput.value = '';
    this.elements.searchScreen.classList.add('hidden');
    this.elements.weatherScreen.classList.remove('hidden');

    // Reset UI
    this.elements.cityName.textContent = city.name;
    this.elements.cityRegion.textContent = [city.admin1, city.country].filter(Boolean).join(' · ');
    AnimationEngine.stop();

    const data = await WeatherService.request(CONFIG.WEATHER_URL, {
      latitude: city.latitude,
      longitude: city.longitude,
      current: 'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,is_day',
      daily: 'weather_code,temperature_2m_max,temperature_2m_min',
      forecast_days: 6,
      timezone: 'auto',
      wind_speed_unit: 'kmh'
    });

    if (data.error) {
      this.elements.condition.textContent = "Erro ao carregar clima.";
      return;
    }

    const c = data.current;
    applyTheme(c.is_day);
    
    this.elements.tempValue.textContent = Math.round(c.temperature_2m);
    this.elements.condition.textContent = WMO_DESC[c.weather_code] || '—';
    this.elements.feels.textContent = `Sensação térmica ${Math.round(c.apparent_temperature)}°C`;
    this.elements.humidity.textContent = `${c.relative_humidity_2m}%`;
    this.elements.wind.textContent = `${Math.round(c.wind_speed_10m)} km/h`;
    this.elements.localTime.textContent = formatters.localTime(data.timezone);
    this.elements.icon.className = `wi ${getWeatherIcon(c.weather_code, c.is_day)} wc-weather-icon`;

    AnimationEngine.start(c.weather_code, c.is_day);
    renderForecast(data.daily, data.timezone);
  }
};

// ── Eventos & Inicialização ──────────────────────
/**
 * Adia a execução da função informada até que decorram {delay} milissegundos após sua última chamada (Debounce pattern).
 * * @param {Function} fn - A função a ser atrasada.
 * @param {number} delay - O tempo em ms.
 * @returns {Function} Função anonima que contém o timer interno de debounce.
 * * @example
 * const runMe = debounce(() => console.log('Executou!'), 300);
 */
const debounce = (fn, delay) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
};

UI.elements.cityInput?.addEventListener('input', debounce((e) => UI.handleSearch(e.target.value), CONFIG.DEBOUNCE_MS));

UI.elements.backBtn?.addEventListener('click', () => {
  UI.elements.weatherScreen.classList.add('hidden');
  UI.elements.searchScreen.classList.remove('hidden');
  AnimationEngine.stop();
  applyTheme();
});

window.addEventListener('resize', () => AnimationEngine.resize());

// Init
applyTheme();
setInterval(() => {
  if (UI.elements.searchScreen.classList.contains('hidden')) return;
  applyTheme();
}, 60000);