# Protótipo — Finanças da Família Reis (tema claro)

Protótipo visual e navegável, em React + Vite + TypeScript, do app de finanças da família no **tema claro**: painel, extrato, leitura de recibos com IA (câmera com guia quadrada, upload de PDF/imagem e status de processamento) e análise de gastos por membro.

> Este protótipo é independente do app principal (pasta `app/`, que segue o contrato visual escuro da família e já está publicado). Serve para avaliar o tema claro e o layout de 4 abas. Os dados são de exemplo (`src/data/mock.ts`) e a leitura por IA é simulada.

## Rodar

```bash
cd prototipos/familia-reis-light
npm install
npm run dev
```

## Estrutura

```
src/
  components/   blocos de interface independentes
    Header.tsx            saudação, mês, avisos (com badge) e engrenagem
    BalanceCard.tsx       saldo geral com gradiente azul e olho de privacidade
    OverviewCards.tsx     entradas (verde) e saídas (vermelho)
    BudgetProgress.tsx    barra do limite mensal (verde → amarelo → vermelho)
    TransactionList.tsx   lista "quem gastou" com etiqueta do membro
    BottomNav.tsx         barra inferior de 4 abas, botão central em destaque
    ReceiptScanner.tsx    câmera com quadro-guia e recorte quadrado
    UploadArea.tsx        arrastar e soltar / seletor de PDF e imagem
    AiStatusCard.tsx      "IA lendo o seu recibo..." com spinner e esqueleto
    MemberBreakdown.tsx   barras de gasto por membro
    CategoryIcon.tsx      ícones Lucide por categoria
  screens/      telas montadas a partir dos componentes
    HomeScreen.tsx · StatementScreen.tsx · SmartUploadScreen.tsx · MembersScreen.tsx
  styles/       tokens.css (paleta) e global.css (layout e componentes)
  data/mock.ts  dados de exemplo da família
  utils/format.ts  moeda e datas em pt-BR
```

## Paleta

| Papel | Cor |
|---|---|
| Fundo | `#F8F9FA` |
| Texto | `#212529` |
| Positivo (entradas, saldo) | `#2D6A4F` |
| Negativo (saídas, alertas) | `#BA1A1A` |
| Acento e botões | `#005F73` |

Cartões com `border-radius: 16px`, espaçamento generoso e tipografia legível para todas as idades.
