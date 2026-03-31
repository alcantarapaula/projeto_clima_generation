# Relatório de Auditoria de Licenciamento e Conformidade
**Projeto:** Clima360  
**Data:** 31 de março de 2026  
**Escopo:** Dependências de front-end (fontes, ícones, APIs, CDN)  
**Contextos avaliados:** Educacional e Comercial

---

## 1. Resumo Executivo

O Clima360 utiliza cinco componentes de terceiros. Todos possuem licenças permissivas compatíveis com uso educacional e comercial, **desde que as obrigações de atribuição sejam cumpridas**. Nenhum conflito de licença foi encontrado.

---

## 2. Inventário de Licenças

| Componente | Versão | Licença | Uso comercial | Atribuição obrigatória |
|---|---|---|---|---|
| Bodoni Moda | — | SIL OFL 1.1 | ✅ Permitido | ✅ Sim |
| Outfit | — | SIL OFL 1.1 | ✅ Permitido | ✅ Sim |
| Weather Icons (fonte) | 2.0.10 | SIL OFL 1.1 | ✅ Permitido | ✅ Sim |
| Weather Icons (CSS) | 2.0.10 | MIT | ✅ Permitido | ✅ Sim (em cópias) |
| Open-Meteo API | — | CC BY 4.0 | ✅ Permitido | ✅ Obrigatório |

---

## 3. Análise Individual das Licenças

### 3.1 SIL Open Font License 1.1 (Bodoni Moda, Outfit, Weather Icons fonte)

**O que permite:** usar, estudar, modificar e redistribuir as fontes livremente, inclusive em produtos comerciais.

**O que restringe:** as fontes não podem ser vendidas isoladamente como produto; obras derivadas devem manter a mesma licença OFL.

**Obrigação:** incluir o copyright original e o texto da licença em qualquer redistribuição que contenha os arquivos de fonte. Como o projeto carrega as fontes via Google Fonts e cdnjs (sem redistribuir os arquivos diretamente), a obrigação é cumprida por meio do `NOTICE.md`.

**Compatibilidade com MIT (licença do projeto):** ✅ Compatível. A OFL se aplica especificamente aos arquivos de fonte; o código JavaScript e HTML do projeto continuam sob MIT sem conflito.

---

### 3.2 MIT License (Weather Icons CSS, código do projeto)

**O que permite:** uso irrestrito, incluindo comercial e redistribuição.

**Obrigação:** manter o aviso de copyright nas cópias do software.

**Conformidade no projeto:** ✅ O `LICENSE.txt` inclui o aviso de copyright do projeto. O `NOTICE.md` registra o Weather Icons com sua licença MIT para cumprir a obrigação de atribuição.

---

### 3.3 Creative Commons Attribution 4.0 International — CC BY 4.0 (Open-Meteo)

Esta é a licença com a obrigação mais relevante do projeto.

**O que permite:** usar, adaptar e redistribuir os dados, inclusive comercialmente.

**Obrigação:** toda interface ou produto que exiba dados da Open-Meteo deve apresentar atribuição visível ao usuário final, indicando a fonte dos dados.

**Conformidade no projeto:** ✅ A atribuição está presente no modal de Privacidade & Termos da aplicação, com nome do provedor e link para a política deles. Para uso comercial intensivo (produto SaaS, app publicado em loja), recomenda-se verificar os [Termos de Uso comerciais da Open-Meteo](https://open-meteo.com/en/terms), pois planos de uso elevado podem exigir licença paga.

---

## 4. Compatibilidade entre Licenças

```
Clima360 (MIT)
├── Bodoni Moda ........... SIL OFL 1.1  → ✅ Compatível
├── Outfit ................ SIL OFL 1.1  → ✅ Compatível
├── Weather Icons (fonte).. SIL OFL 1.1  → ✅ Compatível
├── Weather Icons (CSS) ... MIT          → ✅ Compatível (mesma licença)
└── Open-Meteo (dados) .... CC BY 4.0   → ✅ Compatível com atribuição
```

Nenhum componente usa licenças copyleft fortes (GPL, AGPL) que exigiriam que o código do projeto fosse aberto. A combinação é inteiramente compatível com distribuição comercial e educacional.

---

## 5. Checklist de Conformidade

| Obrigação | Status |
|---|---|
| Fontes tipográficas corretas declaradas no NOTICE.md | ✅ |
| Versão correta do Weather Icons declarada | ✅ |
| Atribuição CC BY 4.0 da Open-Meteo visível na UI | ✅ Modal de privacidade |
| LICENSE.txt presente com copyright do projeto | ✅ |
| LICENSE.txt em inglês e português | ✅ |
| NOTICE.md com URLs e licenças de todos os componentes | ✅ |
| Resumo de licenças de terceiros no LICENSE.txt | ✅ |
| Nenhuma dependência com licença incompatível (GPL, AGPL) | ✅ |

---

## 6. Recomendações

**Para uso educacional (situação atual):** conformidade total com os arquivos gerados. Nenhuma ação adicional necessária.

**Para uso comercial com tráfego elevado:** verificar o plano de uso da Open-Meteo. A API é gratuita até determinado volume de requisições; acima disso, um contrato comercial pode ser necessário — o que não altera as obrigações de licença, mas é uma obrigação contratual separada.

**Para redistribuição do código-fonte:** incluir os arquivos `LICENSE.txt` e `NOTICE.md` em qualquer fork ou distribuição do projeto, conforme exigido pela licença MIT.

---

*Relatório gerado como parte da auditoria de licenciamento do projeto Clima360 — Turma TJS13 Generation Brasil.*
