# ARKANOID // MS-DOS Edition

Breakout retrô monocromático inspirado nos IBM PC dos anos 80, construído como **PWA**: instala no celular, roda offline e funciona como SPA em uma única página. Sem dependências, sem frameworks — **HTML5 + CSS3 + JavaScript Vanilla**.

![Stack](https://img.shields.io/badge/vanilla-HTML%2FCSS%2FJS-%2333ff66?style=flat-square) ![PWA](https://img.shields.io/badge/PWA-offline%20ready-%2333ff66?style=flat-square) ![License](https://img.shields.io/badge/licen%C3%A7a-MIT-%2333ff66?style=flat-square)

## 🕹 Jogar

**Preview**: [https://andrejoaolopes1979-svg.github.io/arkanoid/](https://andrejoaolopes1979-svg.github.io/arkanoid/)

Instale no celular: abra o preview no navegador e use **"Adicionar à tela inicial"**. Depois do primeiro acesso, o jogo funciona 100% offline.

## ✨ Recursos

- **Estética CRT/MS-DOS**: fósforo verde `#33FF66` sobre preto, scanlines, flicker e vinheta simulando tubo de imagem.
- **SPA**: todas as telas (menu, ajuda, jogo, resultado e ranking) alternadas via DOM, com sequência de boot e logo ASCII gerado em bitmap.
- **PWA**: `manifest.json` + Service Worker com estratégia *cache-first* para instalação e uso offline.
- **Controles adaptáveis**:
  - Desktop: setas `←`/`→` (ou `A`/`D`), mouse/arraste e `Espaço` para lançar.
  - Mobile: arraste do dedo sobre a tela + botões virtuais `◄◄`/`►►` e `LANÇAR`.
- **Som PC Speaker**: bips gerados em tempo real pela **Web Audio API** (ondas quadradas, sem arquivos externos) — mutável com `M`.
- **Persistência local**: top 10 de pontuações no `localStorage`, com nome de 3 letras e recorde exibido no HUD.

## 🎮 Como jogar

1. Mova a raquete para embaixo da bola e lance no momento certo.
2. Quebre todos os blocos para avançar de fase — a bola fica mais rápida a cada nível (5 no total).
3. Cada bloco vale pontos conforme a linha; os blocos listrados exigem **2 toques**.
4. Você tem 3 vidas. Perdeu a bola? Ela retorna à raquete. Sem vidas = game over.

| Tecla | Ação |
| --- | --- |
| `←` `→` ou `A` `D` | Mover a raquete |
| `Espaço` / `Enter` | Lançar a bola / continuar |
| `P` / `Esc` | Pausar |
| `M` | Som on/off |

## 🚀 Executar localmente

O projeto não tem build nem servidor de dependências. Para desenvolver (e testar o Service Worker, que exige HTTP/localhost):

```bash
git clone https://github.com/andrejoaolopes1979-svg/arkanoid.git
cd arkanoid
python3 -m http.server 8080
```

Abra [http://localhost:8080](http://localhost:8080).

> Observação PWA: Service Worker também funciona em `https://` e em `localhost`/`127.0.0.1` (não em arquivo `file://` puro).

## 📁 Estrutura

```
arkanoid/
├── index.html          SPA — telas de menu, ajuda, jogo, resultado e ranking
├── css/
│   └── style.css       Tema CRT mono, scanlines, painéis, layout mobile-first
├── js/
│   └── app.js          Motor do jogo, física, Web Audio, telas, localStorage
├── manifest.json       Metadados do PWA (instalação, ícones, theme-color)
├── sw.js               Service Worker — cache-first + offline + navegação
└── icons/              Ícones PWA 192/512 (gerados por script, sem assets externos)
```

## ⚙ Arquitetura

`js/app.js` é organizado em módulos através de IIFEs e uma classe:

| Módulo | Responsabilidade |
| --- | --- |
| `AudioFX` | Síntese de bips pelo Web Audio (oscillator + envelope) |
| `HighScores` | Persistência do ranking no `localStorage` |
| `Menu` | Navegação do menu inicial via teclado/toque |
| `Screens` | Roteamento SPA entre os painéis do DOM |
| `Game` | Loop `requestAnimationFrame`, física, colisões, HUD e fases |

### Física

- Posições em unidades lógicas de 480×600, escaladas para caber na tela via CSS/DPR.
- A raquete reflete a bola com **ângulo proporcional ao ponto de impacto** (até 60°).
- Colisão com blocos por detecção círculo-retângulo, resolvida pelo eixo de menor penetração.
- Velocidade da bola aumenta por fase (`BASE_SPEED + SPEED_STEP × nível`), com teto.

### Persistência

Chave `arknoid.scores.v1` no `localStorage` guarda até 10 registros `{ name, score, level }`. O top-10 é classificado por pontuação e exibido na tela de *high-scores* (botão "APAGAR" limpa a arcada).

## 📄 Licença

Licenciado sob [MIT](LICENSE).

**© 2026 · Desenvolvido por André Lopes**