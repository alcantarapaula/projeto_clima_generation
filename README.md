# 🌦️ Clima360 — Experiência Meteorológica Dinâmica

O **Clima360** é uma aplicação web moderna e resiliente para consulta de previsões meteorológicas em tempo real. Utilizando a API pública da **Open-Meteo**, o projeto transforma dados técnicos em uma experiência visual imersiva através de animações dinâmicas e trocas automáticas de interface baseadas no horário local da cidade buscada.

---

## 📌 Principais Funcionalidades

* **🔍 Busca Inteligente:** Autocomplete de cidades com geocodificação global via Open-Meteo Geocoding API.
* **🎭 Engine de Animação (Canvas):** Renderização dinâmica de condições climáticas (Chuva, Neve, Tempestade com raios, Neblina, Raios de sol e Estrelas) usando HTML5 Canvas.
* **🌡️ Dados Completos:** Visualização de temperatura atual, sensação térmica, umidade, velocidade do vento e descrição da condição via códigos WMO.
* **📅 Previsão Estendida:** Exibição detalhada dos próximos 5 dias, incluindo temperaturas máximas e mínimas.
* **🌓 Tema Adaptativo:** Alternância automática entre modos *Day* e *Night* conforme o fuso horário e posição do sol na localidade selecionada.
* **🛡️ Resiliência Total:** Tratamento robusto para cenários de falta de internet (offline), erros de API e dados inconsistentes.
* **🔒 Segurança:** Proteção contra XSS com sanitização de dados externos, Content Security Policy (CSP) e Referrer Policy configurados.

---

## 🚀 Tecnologias Utilizadas

* **JavaScript (Vanilla ES6+):** Lógica modular com funções dedicadas para serviço de API, UI e Engine de Animação.
* **HTML5 & CSS3:** Estrutura semântica e estilização moderna com variáveis CSS para temas dinâmicos.
* **Bodoni Moda & Outfit:** Tipografia via Google Fonts — Bodoni Moda para display e Outfit para interface.
* **Canvas API:** Para animações de partículas de alto desempenho.
* **Weather Icons v2.0.10:** Ícones meteorológicos via cdnjs.
* **Open-Meteo API:** Consumo de dados meteorológicos e geográficos sem necessidade de chave de API.
* **Jest & JSDOM:** Ambiente de testes automatizados para garantir a integridade da lógica e da UI.

---

## 📦 Instalação e Execução

### 1. Clonar o repositório
```bash
git clone https://github.com/alcantarapaula/projeto_clima_generation.git
cd projeto_clima_generation
```

### 2. Instalar as dependências de desenvolvimento
```bash
npm install
```

### 3. Executar a aplicação
Basta abrir o arquivo `index.html` em seu navegador de preferência ou utilizar uma extensão como o *Live Server* no VS Code.

---

## 🧪 Testes Automatizados

O projeto utiliza o **Jest** com **27 testes** organizados em 5 suítes para garantir que cada componente funcione corretamente sob diversas condições. Para rodar a suíte:

```bash
npm test
```

**Suítes e cenários cobertos:**
* ✔️ **fetchWeather** — Retorno de dados válidos (current + daily), erros HTTP, modo offline, JSON inválido e conexão lenta.
* ✔️ **searchCities** — Cidades válidas, cidade inexistente, entrada vazia, entrada abaixo do mínimo e erro de rede.
* ✔️ **renderForecast** — Renderização de 5 linhas, temperaturas corretas, delays de animação, dados ausentes e estrutura do HTML gerado.
* ✔️ **parseDayLabel** — Formatação de datas, capitalização, fusos horários e fallback para fuso inválido.
* ✔️ **isValidQuery** — Entradas válidas, abaixo do mínimo, tipos não-string e strings com apenas espaços.

---

## 📖 Exemplo de Integração Técnica

O código é estruturado de forma que o serviço de clima possa ser facilmente reutilizado ou expandido:

```javascript
// Exemplo de como fetchWeather lida com as requisições
const weatherData = await fetchWeather(-23.55, -46.63);

if (!weatherData.error) {
  console.log(`Temperatura atual: ${weatherData.current.temperature_2m}°C`);
  console.log(`É dia: ${weatherData.current.is_day === 1}`);
  console.log(`Previsão para amanhã: ${weatherData.daily.temperature_2m_max[1]}°C`);
}
```

---

## 📁 Estrutura do Projeto

```text
├── assets/
│   ├── css/
│   │   └── style.css             # Estilização e variáveis de tema dia/noite
│   └── js/
│       └── api.js                # Lógica da API, UI e Engine de Animação
├── api.test.js                   # Suíte de testes automatizados (Jest)
├── index.html                    # Estrutura principal da aplicação
├── LICENSE.txt                   # Licença MIT (inglês e português)
├── NOTICE.md                     # Atribuições e créditos de terceiros
└── README.md                     # Documentação do projeto
```

---

## 📄 Licença

Este projeto está licenciado sob a **MIT License** — consulte o arquivo [LICENSE.txt](LICENSE.txt) para os termos completos em inglês e português.

As dependências de terceiros (fontes, ícones e dados da API) possuem licenças próprias detalhadas no arquivo [NOTICE.md](NOTICE.md).

> Dados meteorológicos fornecidos por [Open-Meteo.com](https://open-meteo.com) sob licença [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

---

*Desenvolvido com foco em performance, experiência do usuário e código limpo.*
