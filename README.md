# Rompimentos — Mapa de rompimentos de fibra óptica

Aplicativo web para **marcar, localizar e pesquisar rompimentos de cabo de fibra óptica** no mapa da rede, a partir da medida do OTDR, do GPS do celular, de um toque no mapa ou de coordenadas.

**Abrir o app:** https://regisalvessimon.github.io/rompimentos/

Funciona no celular e no computador, pode ser instalado como aplicativo (ícone na tela inicial) e continua funcionando sem sinal no campo.

---

## Sumário

- [Para que serve](#para-que-serve)
- [Quem usa e como é o acesso](#quem-usa-e-como-é-o-acesso)
- [Como usar no dia a dia](#como-usar-no-dia-a-dia)
  - [1. Carregar o mapa da rede (KMZ)](#1-carregar-o-mapa-da-rede-kmz)
  - [2. Marcar um rompimento](#2-marcar-um-rompimento)
  - [3. Pesquisar e acompanhar](#3-pesquisar-e-acompanhar)
  - [4. Levar para o Google Earth](#4-levar-para-o-google-earth)
  - [5. Liberar acesso para a equipe](#5-liberar-acesso-para-a-equipe)
  - [Instalar no celular](#instalar-no-celular)
  - [Usar sem sinal](#usar-sem-sinal)
- [Como foi feito](#como-foi-feito)
  - [Tecnologias](#tecnologias)
  - [Arquivos do projeto](#arquivos-do-projeto)
  - [Como o ponto é calculado pela medida do OTDR](#como-o-ponto-é-calculado-pela-medida-do-otdr)
  - [Leitura do KMZ](#leitura-do-kmz)
  - [Onde os dados ficam guardados](#onde-os-dados-ficam-guardados)
  - [Login e permissões](#login-e-permissões)
  - [Modo offline (PWA)](#modo-offline-pwa)
- [Dados de cada rompimento](#dados-de-cada-rompimento)
- [Publicação e manutenção](#publicação-e-manutenção)
- [Autor](#autor)

---

## Para que serve

Quando um cabo de fibra rompe, o técnico mede com o **OTDR** a distância até a falha, por exemplo "6,350 km saindo de Penápolis sentido Araçatuba". Achar esse ponto no campo é demorado: é preciso seguir a rota do cabo no mapa e contar a distância.

O Rompimentos faz isso automaticamente:

- **Calcula o ponto exato do rompimento no mapa**, seguindo o traçado real do cabo cadastrado no KMZ da rede, e não uma linha reta.
- Considera a **folga/reserva técnica** do cabo, que faz o OTDR medir mais do que a distância no mapa.
- Mostra as **coordenadas** e abre o ponto no **Google Maps** para ir até lá.
- Guarda um **histórico de todos os rompimentos** (abertos e reparados), com área, data, identificação (RAL) e observações.
- Permite **pesquisar** por cidade, área ou observação e ver tudo no mapa.
- **Exporta para o Google Earth** (KMZ) a rede junto com os rompimentos.
- É **compartilhado com a equipe**: todos que têm acesso veem os mesmos rompimentos, em tempo real.

## Quem usa e como é o acesso

| Papel | O que pode fazer |
|---|---|
| **Responsável (dono)** | Tudo: marcar, editar, excluir, trocar o mapa base e aprovar ou remover pessoas. |
| **Editor** | Acesso igual ao do responsável: marca, edita, troca o mapa e aprova pessoas. |
| **Só consulta** | Vê o mapa e os rompimentos, pesquisa e exporta. A aba **Marcar** não aparece. |
| **Sem acesso** | Vê só a tela de entrada. Ao entrar, o pedido de acesso vai para o responsável aprovar. |

A entrada é feita com **conta Google** ou com **e-mail e senha** (criada no próprio app, no "Primeiro acesso").

## Como usar no dia a dia

### 1. Carregar o mapa da rede (KMZ)

Aba **Mapa base** → **Carregar meu KMZ**: escolha o arquivo `.kmz` ou `.kml` da rede (o mesmo usado no Google Earth). Também dá para arrastar o arquivo.

- As **rotas** (linhas) viram o traçado do cabo, com as cores do próprio KMZ.
- Os **pontos** com nome (cidades, caixas, POPs etc.) viram opções nos campos "De" e "Para".
- O nome das **pastas** que contêm a palavra "Área" é usado para preencher a área do rompimento automaticamente.
- O mapa fica salvo para toda a equipe: só precisa carregar de novo quando a rede mudar.
- Se o KMZ tiver uma pasta "Rompimentos" exportada pelo próprio app, esses rompimentos são **importados** também, sem duplicar.

O cartão no topo da aba mostra o nome do arquivo, a data de envio e o tamanho da rede (rotas, pontos e km de cabo).

### 2. Marcar um rompimento

Aba **Marcar**. Primeiro escolha **como marcar o local**:

| Modo | Quando usar |
|---|---|
| **Pela medida** | Tem a distância do OTDR. Preencha **De** (onde a medida começa), **Para** (sentido da medida) e a **distância** em km ou metros. O app calcula o ponto seguindo o cabo. |
| **Onde estou** | Está no local do rompimento. O app pega o GPS do celular e vai melhorando a precisão por até 25 segundos. |
| **No mapa** | Sabe onde é. Toque no mapa (com zoom e satélite) para marcar. |
| **Coordenadas** | Recebeu coordenadas ou um link. Aceita `-21.41234, -50.07123`, `21°24'44"S 50°04'16"W` ou um link do Google Maps aberto no navegador. |

Dicas:

- **Ajuste de OTDR (folga do cabo):** informe a porcentagem de reserva técnica. Com 3%, 6 km medidos no OTDR viram cerca de 5,83 km no mapa. Deixe 0 se a distância já é de mapa.
- O botão **⇅** inverte origem e destino.
- O ponto calculado aparece em laranja e **pode ser arrastado** para corrigir à mão.
- Nos modos GPS, mapa e coordenadas, se o ponto estiver a poucos metros do cabo, aparece **Encaixar no cabo** para colocá-lo exatamente sobre a rota.
- Avisos aparecem quando a distância passa do fim do trecho, quando a origem está longe da rede ou quando não há caminho ligado entre os dois pontos.

Depois preencha:

- **Identificação** (RAL ou nome), por exemplo `RAL-704579/2026`
- **Área**, preenchida automaticamente pela pasta do KMZ e editável
- **Situação**: Aberto ou Reparado
- **Data e hora**
- **Observação**, por exemplo "cabo 36F, poste 112, queimada na margem da SP-300"

E toque em **Salvar rompimento**. O resultado mostra as coordenadas, com os botões **Abrir no Google Maps** e **Copiar coordenadas**.

### 3. Pesquisar e acompanhar

Aba **Pesquisar**:

- Busca por **cidade, área, identificação ou observação** (sem diferenciar acentos e maiúsculas). Várias palavras são combinadas.
- Filtros **Todos / Abertos / Reparados** e por **Área**.
- Lista do mais recente para o mais antigo. Tocar em um ponto no mapa destaca o rompimento na lista.
- Em cada rompimento: **Ver no mapa**, **Google Maps**, **Copiar** coordenadas, **Editar**, **Marcar reparado** (ou **Reabrir**) e **Excluir** (com confirmação).
- **Ver todos no mapa** enquadra todos os resultados.
- **Baixar esta pesquisa em KMZ** exporta só o que está filtrado.

No mapa: **vermelho pulsando** = aberto, **verde** = reparado, **laranja** = ponto novo sendo marcado.

### 4. Levar para o Google Earth

Aba **Mapa base** → **Levar para o Google Earth**:

- **KMZ completo**: a sua rede original + uma pasta **"Rompimentos"**, separada em "Abertos" e "Reparados", com ícone de alerta e uma tabela com todos os dados de cada ponto.
- **KMZ só com os rompimentos**.

Esse KMZ pode ser carregado de novo no app depois: a pasta "Rompimentos" é reconhecida e os rompimentos são importados.

### 5. Liberar acesso para a equipe

Aba **Mapa base** → **Quem pode entrar** (só aparece para responsável e editores):

1. Mande o link do app para a pessoa.
2. Ela entra com Google ou cria uma senha com o e-mail dela.
3. O pedido aparece na lista (com um número na aba **Mapa base**).
4. Aprove como **só consulta** ou como **editor**, ou recuse.

Também dá para liberar um e-mail antes da pessoa entrar, trocar alguém entre editor e consulta, ou remover o acesso.

### Instalar no celular

- **Android (Chrome):** botão **Instalar app** no topo, ou menu ⋮ → "Instalar app" / "Adicionar à tela inicial".
- **iPhone (Safari):** botão Compartilhar (□↑) → "Adicionar à Tela de Início".

### Usar sem sinal

Depois de aberto uma vez com internet, o app abre sem sinal. Rompimentos marcados sem sinal ficam salvos no aparelho e são **enviados sozinhos quando o sinal volta** (o app avisa). As partes do mapa de ruas e satélite que já foram vistas também ficam guardadas.

---

## Como foi feito

### Tecnologias

| Parte | Tecnologia |
|---|---|
| Interface | HTML, CSS e JavaScript puro, em um único arquivo (`index.html`), sem framework e sem etapa de build |
| Mapa | [Leaflet](https://leafletjs.com/) 1.9.4, com fundo de ruas e satélite da Esri (ArcGIS) |
| Leitura e geração de KMZ | [JSZip](https://stuk.github.io/jszip/) 3.10.1 (o KMZ é um ZIP com um `doc.kml` dentro) |
| Banco de dados e login | [Firebase](https://firebase.google.com/) (Firestore + Authentication), SDK 10.12.2 |
| Hospedagem | GitHub Pages |
| App instalável e offline | PWA: `manifest.webmanifest` + service worker (`sw.js`) |
| Fundo sem internet | Malha dos municípios de SP (IBGE) embutida na página, com os nomes das cidades |

### Arquivos do projeto

```
index.html              App completo: interface, estilos, cálculos, mapa, login e banco
manifest.webmanifest    Nome, cores e ícones para instalar como aplicativo
sw.js                   Service worker: cache do app e do mapa para funcionar sem sinal
icon-192.png            Ícone do app
icon-512.png            Ícone do app (alta resolução)
icon-maskable-512.png   Ícone adaptável para Android
apple-touch-icon.png    Ícone para iPhone
```

### Como o ponto é calculado pela medida do OTDR

1. **Montagem da rede:** todas as linhas do KMZ viram um **grafo**. Cada vértice da linha é um nó e cada trecho é uma aresta com o comprimento real em metros, calculado pela fórmula de **Haversine** (distância sobre a superfície da Terra).
2. **Emendas:** pontas de linhas que terminam a até **35 m** de outra linha são ligadas a ela, porque no KMZ as rotas costumam não se tocar exatamente. Para isso é usada uma grade espacial, que deixa a busca rápida mesmo em redes grandes.
3. **Origem e destino** são projetados no trecho de cabo mais próximo de cada um.
4. **Caminho mais curto:** o algoritmo de **Dijkstra** encontra a rota pela rede entre origem e destino.
5. **Folga:** a distância do OTDR é dividida por `1 + folga/100` para virar distância de mapa.
6. **Caminhada:** o app percorre a rota a partir da origem somando os trechos até atingir essa distância, e interpola o ponto exato dentro do último trecho.
7. Se não houver rede carregada ou caminho ligado, usa linha reta entre os pontos e avisa.

A **área** é preenchida pela pasta da rota mais próxima do ponto (até 2 km).

### Leitura do KMZ

- O `.kmz` é aberto com JSZip e o `.kml` de dentro é lido com o `DOMParser` do navegador.
- São lidos `Placemark` com `LineString` (rotas), `Point` (pontos) e `Polygon` (áreas), além dos estilos (`Style`, `StyleMap`) para manter as cores originais.
- O caminho de pastas de cada item é guardado para mostrar a área e diferenciar pontos com o mesmo nome.
- Ao exportar, a pasta `Rompimentos` (id `rompimentos-app`) é inserida no fim do documento. Cada rompimento leva os dados completos em `ExtendedData` (campo `romp_json`), o que permite reimportar sem perder nada.

### Onde os dados ficam guardados

No **Firestore** (banco do Firebase), em tempo real para toda a equipe:

| Coleção | Conteúdo |
|---|---|
| `rompimentos` | Um documento por rompimento |
| `config/base` | Informações do mapa base (nome, data, versão, quem enviou) |
| `config/base/partes` | O KML do mapa base, compactado (gzip + base64) e dividido em partes de até ~900 KB, por causa do limite de 1 MB por documento |
| `permitidos` | E-mails liberados e se são editores |
| `pedidos` | Pedidos de acesso aguardando aprovação |

No aparelho, o mapa base fica em cache no **IndexedDB**: só é baixado de novo quando muda de versão.

O app também tem modos alternativos usados durante o desenvolvimento: abrindo o `index.html` direto do computador, os dados ficam só no navegador (IndexedDB); dentro do Claude, usa o banco do próprio Claude. No GitHub Pages ele sempre usa o Firebase.

### Login e permissões

- Login pelo **Firebase Authentication**: Google ou e-mail e senha (com confirmação por e-mail, reenvio do link e "Esqueci a senha").
- Ao entrar, o app lê a entrada do e-mail em `permitidos`. Se não conseguir, registra um pedido em `pedidos` e mostra a tela de espera.
- O responsável é definido nas **regras de segurança do Firestore**, configuradas no console do Firebase (não ficam neste repositório). São essas regras que garantem, no servidor, quem pode ler e quem pode gravar. Esconder botões na tela é só conveniência.
- A chave de API que aparece no `index.html` é a configuração pública do Firebase para apps web. Ela não dá acesso aos dados sozinha: quem protege os dados são as regras do Firestore e o login.

### Modo offline (PWA)

- O `sw.js` guarda o app (página, manifesto e ícones) e busca a versão nova sempre que há internet ("rede primeiro, cache se falhar").
- As imagens do mapa (ruas e satélite) seguem a estratégia "cache primeiro", com limite de 2.500 imagens.
- Login e banco (Firebase/Google) não passam pelo cache; o Firestore tem o próprio modo offline, que guarda as gravações e envia quando o sinal volta.

---

## Dados de cada rompimento

| Campo | Descrição |
|---|---|
| `titulo` | Identificação (RAL ou nome) |
| `origem`, `destino` | Nomes dos pontos de início e sentido da medida |
| `origemLat/Lng`, `destinoLat/Lng` | Coordenadas da origem e do destino |
| `distM`, `unidade` | Distância medida (em metros) e unidade digitada (km ou m) |
| `folgaPct` | Folga/reserva técnica aplicada (%) |
| `lat`, `lng` | Coordenadas do ponto do rompimento |
| `rotaM` | Comprimento do trecho pela rede |
| `metodo` | Como foi marcado: `rota` (OTDR), `manual` (arrastado), `gps`, `mapa` ou `coord` |
| `precisaoM` | Precisão do GPS, quando marcado por GPS |
| `area` | Área da rede |
| `status` | `aberto` ou `reparado` |
| `dataHora` | Data e hora do rompimento |
| `obs` | Observações |
| `criadoEm`, `atualizadoEm`, `criadoPor` | Controle de criação e alteração |

## Publicação e manutenção

- O site é publicado pelo **GitHub Pages** a partir da branch `main` (pasta raiz). Qualquer alteração enviada para a `main` entra no ar em um ou dois minutos.
- Ao mudar arquivos do app, troque a versão do cache no `sw.js` (`romp-app-v1` → `romp-app-v2`) para os celulares pegarem a atualização mais rápido.
- Usuários, regras de acesso e dados são administrados no **console do Firebase** (projeto `rompimentos-8e475`).
- Para testar localmente sem mexer nos dados reais, abra o `index.html` direto no navegador: os dados ficam só naquele navegador.

## Autor

**Reginaldo Alves Simon**
[LinkedIn](https://www.linkedin.com/in/reginaldo-alves-simon)
