# ALMOX GGF — Gestão de Frota e Almoxarifado

Sistema privado de gestão de veículos, pneus, óleo, filtros e pedidos do Almoxarifado GGF.

## Funcionalidades

- Cadastro de veículos por prefixo, placa e plaqueta patrimonial.
- Visualização 3D interativa por categoria de veículo.
- Modelo ilustrativo específico para o ON-84, inspirado no Volare escolar amarelo com faixa preta da referência selecionada.
- Pneus identificados por eixo, lado e posição; trocas registradas destacadas em vermelho.
- Histórico de trocas de óleo e pneus.
- Pedidos numerados, relação de filtros e exportação CSV.
- Interface em português com identidade visual da Prefeitura de Sorriso.

## Organização

| Pasta | Conteúdo |
| --- | --- |
| `dist/` | Interface HTML, CSS e JavaScript |
| `dist/truck3d.js` | Visualizador tridimensional interativo |
| `server/worker.js` | API de pedidos, veículos e manutenções |
| `drizzle/` | Estrutura SQL do banco de dados |
| `assets/` | Logomarca utilizada na interface |
| `scripts/build.mjs` | Gera `dist/server/index.js` |

## Desenvolvimento

É necessário Node.js moderno (com suporte a `import.meta.dirname`).

```bash
node scripts/build.mjs
node --check dist/server/index.js
```

O resultado do build é o Cloudflare Worker `dist/server/index.js`, com os arquivos do frontend incorporados.

## GitHub e hospedagem

Neste pacote para GitHub, o **`index.html` fica na raiz**, junto dos arquivos CSS e JavaScript. Assim, é possível abrir a interface estática sem mover pastas. A pasta `dist/` permanece como a versão de origem utilizada no build do Worker.

**O GitHub serve para guardar e versionar este código.** O sistema completo **não funciona somente com GitHub Pages**, pois depende de uma API privada, autenticação da plataforma e banco D1.

O projeto original utiliza o ambiente **ChatGPT Sites** com:

- autenticação privada do proprietário;
- cabeçalho de identidade `oai-authenticated-user-id`, injetado pelo ambiente de hospedagem;
- binding de banco de dados D1 chamado `DB`.

Para hospedar fora do ChatGPT Sites, será preciso configurar um banco compatível, autenticação segura de usuários e as migrations SQL antes de publicar. **Não exponha o Worker sem substituir a autenticação do ambiente original por uma autenticação confiável.** Nunca aceite `oai-authenticated-user-id` diretamente de visitantes pela internet.

Este pacote contém **somente código e recursos visuais**. Não contém os registros existentes no banco de dados, senhas, tokens ou uma exportação da base.

## Enviar para o GitHub

1. Crie um repositório **privado** no GitHub.
2. Extraia o arquivo ZIP recebido.
3. No GitHub, abra o repositório e selecione **Add file → Upload files**.
4. Envie os arquivos e pastas extraídos e confirme o commit.

Para atualizações posteriores, use Git ou GitHub Desktop; não é necessário reenviar tudo manualmente.

## Observação sobre o modelo 3D

O ON-84 possui representação tridimensional programática baseada na referência fotográfica escolhida. Ela é interativa, mas **não é uma reconstrução fotorrealista certificada**, nem substitui um arquivo 3D de engenharia ou um modelo escaneado do veículo.
