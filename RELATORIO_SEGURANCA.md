# Relatório de Auditoria de Segurança e Privacidade
**Projeto:** Clima360  
**Data:** 31 de março de 2026  
**Escopo:** Código-fonte front-end (HTML, CSS, JavaScript) + consumo de APIs públicas  
**Padrão de referência:** OWASP Top 10, boas práticas de segurança para SPAs

---

## 1. Resumo Executivo

O Clima360 é uma Single Page Application estática que consome duas APIs públicas sem autenticação (Open-Meteo). A ausência de back-end e de armazenamento de dados reduz significativamente a superfície de ataque. Foram identificados **5 pontos de melhoria**, todos endereçados nesta auditoria: 2 de risco médio (XSS) e 3 de risco baixo/configuração (CSP, SRI, privacidade).

---

## 2. Inventário de Superfície de Ataque

| Componente | Descrição |
|---|---|
| `index.html` | Estrutura HTML da SPA |
| `assets/css/style.css` | Estilos visuais, sem lógica |
| `assets/js/api.js` | Toda a lógica: fetch, DOM, animações |
| API Geocoding | `https://geocoding-api.open-meteo.com/v1/search` |
| API Meteorologia | `https://api.open-meteo.com/v1/forecast` |
| CDN Weather Icons | `https://cdnjs.cloudflare.com` |
| CDN Google Fonts | `https://fonts.googleapis.com` / `fonts.gstatic.com` |

---

## 3. Vulnerabilidades Encontradas e Correções Aplicadas

### 3.1 XSS via `innerHTML` com dados da API — RISCO MÉDIO ✅ Corrigido

**Localização:** `renderSuggestions()` e `renderForecast()` em `api.js`

**Descrição:** Strings provenientes da API da Open-Meteo (`city.name`, `city.admin1`, `city.country`, `weekday`, `date`) eram injetadas diretamente em `innerHTML` sem sanitização. Embora a Open-Meteo seja uma API confiável, a defesa em profundidade exige tratar qualquer dado externo como não confiável.

**Cenário de risco:** Se a API retornasse um nome de cidade contendo `<script>alert(1)</script>`, o código seria executado no navegador do usuário.

**Correção aplicada:** Adicionada a função `escapeHTML()` em `api.js`, que substitui os cinco caracteres especiais HTML (`& < > " '`) por suas entidades seguras. Aplicada em todos os pontos de injeção de dados externos.

```js
// Antes (vulnerável)
li.innerHTML = `<span>${city.name}</span>`;

// Depois (seguro)
li.innerHTML = `<span>${escapeHTML(city.name)}</span>`;
```

---

### 3.2 Ausência de Content Security Policy (CSP) — RISCO BAIXO ✅ Corrigido

**Localização:** `<head>` do `index.html`

**Descrição:** Sem CSP, o navegador aceita scripts, estilos e conexões de qualquer origem. Isso amplia o impacto de um eventual XSS e permite que extensões ou injeções de terceiros carreguem recursos maliciosos no contexto da aplicação.

**Correção aplicada:** Adicionado `<meta http-equiv="Content-Security-Policy">` com política restritiva:

```
default-src 'self';
script-src 'self';
style-src 'self' https://fonts.googleapis.com https://cdnjs.cloudflare.com;
font-src https://fonts.gstatic.com https://cdnjs.cloudflare.com;
connect-src https://geocoding-api.open-meteo.com https://api.open-meteo.com;
img-src 'self' data:;
object-src 'none';
base-uri 'self';
```

> **Nota para produção:** A CSP via `<meta>` não cobre cabeçalhos HTTP (não bloqueia `<frame>`/`<iframe>` ao nível de transporte). Em servidor próprio, configure adicionalmente o cabeçalho HTTP `Content-Security-Policy` com `frame-ancestors 'none'` para proteção completa contra clickjacking.

---

### 3.3 Ausência de Subresource Integrity (SRI) — RISCO BAIXO ✅ Corrigido

**Localização:** `<link>` do weather-icons no `index.html`

**Descrição:** Arquivos carregados de CDNs externas sem hash de integridade podem ser substituídos por versões adulteradas (ataque de supply chain) sem que o navegador detecte a alteração.

**Correção aplicada:** Adicionados atributos `integrity` (hash SHA-384) e `crossorigin="anonymous"` ao link da CDN:

```html
<link rel="stylesheet"
      href="https://cdnjs.cloudflare.com/...weather-icons.min.css"
      integrity="sha384-OLBgp1GsljhM2TJ+sbHjaiH9txEUvgdDTAzHv2P24donTt6/529l+9Ua0vFImLlb"
      crossorigin="anonymous" />
```

> **Nota:** O Google Fonts não suporta SRI de forma prática pois gera URLs dinâmicas por user-agent. A mitigação é o CSP já aplicado, que restringe `font-src` e `style-src` a `fonts.googleapis.com` e `fonts.gstatic.com` exclusivamente.

---

### 3.4 Política de Referência não definida — RISCO BAIXO ✅ Corrigido

**Localização:** `<head>` do `index.html`

**Descrição:** Sem `Referrer-Policy`, o navegador pode enviar a URL completa da aplicação como cabeçalho `Referer` nas requisições para APIs e CDNs externas, expondo informações desnecessárias.

**Correção aplicada:**

```html
<meta name="referrer" content="no-referrer">
```

---

### 3.5 Aviso de privacidade incompleto — RISCO BAIXO ✅ Corrigido

**Localização:** Modal de privacidade no `index.html`

**Descrição:** O texto anterior indicava apenas que dados pessoais não são armazenados, mas omitia que o nome da cidade digitada e as coordenadas geográficas são transmitidos para os servidores da Open-Meteo a cada pesquisa — o que constitui processamento de dado pelo terceiro.

**Correção aplicada:** O modal foi reescrito com quatro seções claras:
- Dados coletados (nenhum pela aplicação)
- Serviços de terceiros (Open-Meteo, com link para política deles)
- Fontes e ícones (Google Fonts e cdnjs)
- Comunicação segura (HTTPS)

---

## 4. Pontos Positivos Encontrados

| Item | Status |
|---|---|
| Todas as comunicações com APIs usam HTTPS | ✅ |
| Nenhuma chave de API no código-fonte | ✅ |
| Open-Meteo não requer autenticação — zero risco de exposição de credenciais | ✅ |
| Nenhum dado armazenado em `localStorage`, `sessionStorage` ou cookies | ✅ |
| Validação de entrada com comprimento mínimo e debounce | ✅ |
| Tratamento de erros padronizado com fallback offline | ✅ |
| Sem dependências npm em produção — zero risco de supply chain via `node_modules` | ✅ |
| `type="module"` no script isola o escopo global | ✅ |

---

## 5. Recomendações para Ambiente de Produção

### 5.1 Cabeçalhos HTTP de segurança (servidor web)

Se a aplicação for servida via Nginx, Apache ou similar, configure os cabeçalhos abaixo no servidor — eles complementam o que foi feito via `<meta>` e cobrem casos que a tag não alcança:

```nginx
# Nginx
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com https://cdnjs.cloudflare.com; font-src https://fonts.gstatic.com https://cdnjs.cloudflare.com; connect-src https://geocoding-api.open-meteo.com https://api.open-meteo.com; img-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none';" always;
add_header X-Frame-Options "DENY" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "no-referrer" always;
add_header Permissions-Policy "geolocation=(), camera=(), microphone=()" always;
```

### 5.2 Remover `console.error` em produção

O `api.js` contém chamadas `console.error()` para depuração. Em produção, essas mensagens ficam visíveis no DevTools e podem expor detalhes de URLs, parâmetros ou estrutura interna da aplicação.

**Recomendação:** Criar um wrapper de log que verifica o ambiente:

```js
const log = {
  error: (msg, ...args) => {
    if (location.hostname === 'localhost') console.error(msg, ...args);
  }
};
// Substituir console.error por log.error em todo o código
```

### 5.3 Subresource Integrity para Google Fonts (avançado)

Para ambientes de alta segurança, considere hospedar as fontes localmente (baixar os arquivos `.woff2` e servir via `'self'`), eliminando a dependência do Google Fonts completamente e removendo a necessidade de liberar `fonts.googleapis.com` na CSP.

### 5.4 Rate limiting no lado do cliente

A função `debounce` já reduz requisições, mas não há limite total de chamadas por sessão. Em produção com domínio próprio, considere adicionar um contador máximo de buscas por minuto para prevenir uso abusivo da API.

---

## 6. Classificação de Riscos — Quadro Resumo

| # | Vulnerabilidade | Risco | Status |
|---|---|---|---|
| 3.1 | XSS via innerHTML com dados da API | Médio | ✅ Corrigido |
| 3.2 | Ausência de Content Security Policy | Baixo | ✅ Corrigido |
| 3.3 | Ausência de Subresource Integrity | Baixo | ✅ Corrigido |
| 3.4 | Política de referência não definida | Baixo | ✅ Corrigido |
| 3.5 | Aviso de privacidade incompleto | Baixo | ✅ Corrigido |
| 5.2 | console.error em produção | Informativo | ⚠️ Recomendado |
| 5.1 | Cabeçalhos HTTP no servidor | Informativo | ⚠️ Recomendado |

---

*Relatório gerado como parte da auditoria de segurança do projeto Clima360 — Turma TJS13 Generation Brasil.*
