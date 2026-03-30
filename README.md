# 🌦️ Projeto Clima360

Aplicação web para busca de cidades e visualização de dados meteorológicos em tempo real utilizando a API pública da Open-Meteo.

---

## 📌 Funcionalidades

* 🔍 Busca de cidades com autocomplete
* 🌡️ Exibição de dados meteorológicos atuais
* 🌙 Alternância automática entre tema claro/escuro
* ⚡ Interface responsiva e dinâmica
* 🛡️ Tratamento de erros (API, offline, dados inválidos)
* 🧪 Testes automatizados com Jest

---

## 🚀 Tecnologias utilizadas

* JavaScript (Vanilla)
* HTML / CSS
* API: Open-Meteo
* Jest (testes automatizados)

---

## 📦 Instalação e execução

### 1. Clonar o repositório

```bash
git clone https://github.com/alcantarapaula/projeto_clima_generation.git
cd projeto_clima_generation
```

### 2. Instalar dependências

```bash
npm install
```

### 3. Executar os testes

```bash
npm test
```

---

## 🧪 Testes

A aplicação possui testes automatizados cobrindo:

* ✔ Busca de cidades válidas
* ✔ Tratamento de cidade inexistente
* ✔ Validação de entrada
* ✔ Erros da API
* ✔ Falta de conexão com internet
* ✔ Limite de requisições (HTTP 429)
* ✔ Conexão lenta/instável
* ✔ Mudanças inesperadas no JSON

---

## 📁 Estrutura do projeto

```
├── src/
│   └── api.js
├── tests/
│   └── api.test.js
├── index.html
├── style.css
└── README.md
```

---

## ⚠️ Tratamento de erros

A aplicação trata diferentes cenários:

* 📡 Offline → mensagem ao usuário
* ❌ Erro da API → fallback seguro
* ⚠️ Dados inválidos → prevenção de quebra da UI

---

## 📖 Exemplo de uso

```javascript
const cities = await searchCities('São Paulo');

if (cities.length) {
  const weather = await fetchWeather(
    cities[0].latitude,
    cities[0].longitude
  );

  console.log(weather);
}
```

---

## 🎯 Objetivo do projeto

Este projeto foi desenvolvido com foco em:

* Prática de consumo de APIs
* Manipulação de DOM
* Escrita de testes automatizados
* Tratamento de erros e resiliência
* Organização e documentação de código

---

## 📄 Licença

Este projeto é para fins educacionais.

```
```
