# RDO360: histórico e funções da aplicação

Aplicação web para preencher o Relatório Diário de Obra (RDO) em equipe, assinar e exportar em PDF.

- **Tecnologia:** React com TanStack (rotas e dados), Supabase (banco, login, arquivos e tempo real) e Lovable (publicação).
- **Atualizado em:** 02/11/2026.

---

## 1. Histórico de implementação, em ordem

### 1.1 Base do aplicativo (27 a 30/10/2026, feita no Lovable)

1. Modelo inicial do projeto.
2. Formulário do RDO com exportação em PDF.
3. Campos de mão de obra e condições climáticas.
4. Conexão com o Supabase, sem mudanças no banco.
5. Login por nome e senha, perfis e permissões visuais.
6. Aba Equipe para administradores.
7. Número do RDO ligado à data, a partir de uma referência da obra.
8. Navegação por dia e aba Histórico, com filtro por mês, busca por número, status e efetivo.
9. Mão de obra salva no banco, em três categorias, e incluída no PDF.

> Nessa fase, só a identificação do RDO e a mão de obra iam para o banco. As demais seções ficavam apenas no navegador de quem preenchia.

### 1.2 Marca RDO360 e PDF compacto (29 a 30/10/2026)

Commit `4971e3c`.

10. Nome RDO360 e cabeçalho "RDO360 – Diário de obra: nome da obra".
11. Turnos do clima: Manhã, Tarde e Noite anterior, com lua no tempo bom da noite.
12. Ordem do efetivo: Indireto, Direto e Terceirizado.
13. Atividades com local no lugar do "% avanço", ordenadas por frente.
14. PDF sem campos de ocorrência vazios.
15. Opção de incluir ou não as fotos no PDF, com renumeração das assinaturas.
16. Efetivo e equipamentos em colunas, e quebras de página sem espaços em branco.

### 1.3 Dados compartilhados em tempo real (30/10/2026)

Commit `a92b3f7`. SQL: `rdo360-etapa1.sql`.

17. Todas as seções do diário salvas no Supabase, e fotos no Storage.
18. Salvamento automático, com o aviso "Salvando… / Tudo salvo / Erro ao salvar".
19. Atualização em tempo real entre usuários, sem recarregar a página.
20. Proteção contra conflitos: uma gravação feita sobre dados desatualizados é recusada, com aviso.
21. Edição de cada lançamento restrita ao autor ou a quem pode editar lançamentos de outros.
22. Importação dos rascunhos antigos guardados no navegador.

### 1.4 Migração de outubro/2026 (01/11/2026)

23. Importação dos RDOs nº 976 a 1000 (01 a 25/10/2026) a partir da planilha, conferida com o PDF original.

> Feita por SQL no Supabase. Os arquivos ficam em `supabase/importacao/`, fora do Git, porque têm dados reais da obra.

### 1.5 Fechamento e novas funções (30/10 a 02/11/2026)

Commit desta entrega. SQLs: `rdo360-busca-sem-acentos.sql`, `rdo360-dados-obra.sql`, `rdo360-assinatura.sql` e `rdo360-excluir-rdos.sql`.

24. Autocompletar de atividades por frente, ignorando acentos.
25. Exportação de vários RDOs em um único PDF, com seleção no Histórico.
26. Botão de fechar e reabrir o RDO.
27. Aba Dados, com o seletor de obra e os dados contratuais fora do preenchimento diário.
28. Novos campos: Fiscalização e Gerenciadora. Endereço passou a ser Local, e Responsável técnico passou a ser Contratada.
29. Logo da contratada, com redimensionamento automático.
30. Cabeçalho refeito, com a fonte do nome da obra ajustada ao tamanho do texto.
31. Textos "Precipitação (mm)" no PDF e "Pluviômetro - Precipitação (mm)" no preenchimento.
32. Assinaturas renomeadas para Contratada e Gerenciadora.
33. Cadastro da assinatura carimbada por perfil, com remoção automática do fundo.
34. Botão "Assinar RDO", com a imagem no PDF e o selo verde "Assinado por" no Histórico.
35. RDO assinado travado para alterações, e a permissão "Alterar RDO's assinados".
36. Botão "Excluir RDO's" no Histórico, com alerta e confirmação em vermelho.

### 1.6 Correção da importação de rascunhos antigos (02/11/2026)

37. O aviso de rascunho passou a mostrar o que será importado e o que difere do RDO.
38. A importação não duplica lançamentos nem substitui valores, e ignora o que o formulário antigo preenchia sozinho.
39. Rascunhos sem nada novo são limpos automaticamente, e RDOs travados não aceitam importação.

---

## 2. Funções atuais

### Acesso

- Login por nome e senha. Só a tela de login é pública.
- Contas desativadas não conseguem entrar.

### Abas

| Aba | Quem vê | Para que serve |
|---|---|---|
| RDO | Todos | Preencher e assinar o RDO do dia |
| Dados | Quem tem "Editar dados da obra e frentes" | Dados contratuais e logo |
| Histórico | Todos | Consultar, exportar e excluir RDOs |
| Equipe | Administradores | Usuários, permissões e assinaturas |

### RDO do dia

- Navegação por dia anterior, próximo dia, hoje ou qualquer data.
- Número e data ligados: alterar um recalcula o outro.
- Criar RDO, mover para outra data, fechar e reabrir, conforme as permissões.
- Salvamento automático e atualização em tempo real.
- Seções, numeradas como no PDF:
  - **2. Condições climáticas:** clima por turno, horário de trabalho, precipitação às 07:00, 12:00 e 17:00, e maré máxima.
  - **3. Mão de obra:** funções e quantidades por categoria, com subtotais e efetivo total.
  - **4. Equipamentos:** descrição e quantidade.
  - **5. Atividades executadas:** descrição e local, com sugestões de atividades já usadas naquela frente.
  - **6. Ocorrências e observações:** gerais e de segurança do trabalho, com uma anotação por autor.
  - **7. Registro fotográfico:** até 20 fotos com legenda, e opção de incluir no PDF.
  - **8. Assinaturas:** Contratada e Gerenciadora, e o botão de assinar.

### Rascunhos antigos

- Aparecem como aviso no dia, só no navegador em que foram digitados, antes da mudança de 30/10/2026.
- O aviso lista o que será importado, o que difere do RDO e o que está sem local.
- Importar só acrescenta o que falta. Fotos não têm como ser comparadas, então o aviso as mostra para conferência.
- Descartar apaga apenas o rascunho daquele navegador.

### Aba Dados

- Campos, na ordem: Obra, Cliente, Fiscalização, Local, Gerenciadora, Contratada, Logo, Contrato nº, Início contratual e Término contratual.
- Logo em PNG, JPG ou WEBP, de até 5 MB.
- Os dados aparecem em todos os RDOs.

### Assinatura

- O administrador cadastra a imagem da assinatura carimbada em Equipe, em PNG, JPG ou WEBP de até 10 MB.
- Quem tem assinatura cadastrada vê o botão "Assinar RDO".
- O RDO guarda o nome e a imagem usados na hora de assinar. Trocar o cadastro depois não muda RDOs já assinados.
- Só quem assinou ou um administrador pode remover a assinatura.
- O registro é uma imagem com autoria e data internas. Não é assinatura digital certificada (ICP-Brasil).

### PDF

- Gerado pela janela de impressão do navegador, em A4.
- Cabeçalho com logo, nome da obra, número, data e dia da semana.
- Item 1 com os dados da obra, e seções numeradas.
- Campos de ocorrência vazios e fotos desmarcadas não aparecem.
- A assinatura sai como imagem sobre a linha da Contratada, sem fundo e com pequena variação de posição entre RDOs.

### Histórico

- Lista de RDOs com número, data, status, efetivo e selo verde "Assinado por".
- Filtro por mês e busca por número.
- Seleção individual ou de todo o filtro. A seleção é mantida ao trocar de mês.
- PDF único em ordem cronológica, com cada RDO em nova página.
- Exclusão de RDOs, somente para administradores, com alerta e confirmação.

### Equipe

- Criar usuários, redefinir senhas e ativar ou desativar contas.
- Cadastrar a assinatura de cada perfil.
- Definir permissões:
  - Ver todos os RDOs
  - Editar dados da obra e frentes
  - Lançar mão de obra
  - Lançar equipamentos
  - Clima, pluviômetro e maré
  - Lançar atividades, ocorrências, segurança e fotos
  - Editar/excluir lançamento de outra pessoa
  - Fechar e reabrir RDO (e assinaturas)
  - Alterar número/data do RDO
  - Alterar RDO's assinados
  - Exportar PDF

### Regras de alteração de um RDO

| Situação do RDO | Quem pode alterar |
|---|---|
| Aberto | Quem tem a permissão da seção |
| Fechado | Quem também tem "Fechar e reabrir RDO" |
| Assinado | Quem também tem "Alterar RDO's assinados" |

Administradores têm todas as permissões. As regras valem no banco, não só na tela, e as alterações ficam registradas na tabela `historico`.

---

## 3. SQLs aplicados no Supabase, em ordem

| Ordem | Arquivo | O que faz |
|---|---|---|
| 1 | `supabase/rdo360-etapa1.sql` | Colunas de horário e fotos no PDF, proteção de permissões e tempo real |
| 2 | `supabase/importacao/importar-outubro-2026.sql` (fora do Git) | Importa os RDOs de 01 a 25/10/2026 |
| 3 | `supabase/rdo360-busca-sem-acentos.sql` | Sugestões de atividades sem diferenciar acentos |
| 4 | `supabase/rdo360-dados-obra.sql` | Novos campos da obra e armazenamento da logo |
| 5 | `supabase/rdo360-assinatura.sql` | Assinatura, travamento e permissão de RDOs assinados |
| 6 | `supabase/rdo360-excluir-rdos.sql` | Exclusão de RDOs por administradores |

---

## 4. Limitações e próximos passos

- **Multi-obra:** o seletor da aba Dados só tem uma obra, porque o banco comporta apenas uma. Atender várias obras exige ligar RDOs e frentes a cada obra, ter numeração por obra e definir quem acessa cada uma. É melhor fazer isso antes de importar muitos outros meses.
- **Outros meses:** a importação foi feita só para 01 a 25/10/2026. Os demais meses podem seguir o mesmo processo a partir das planilhas.
- **Exclusão:** os dados dos lançamentos ficam copiados na tabela `historico`, mas os arquivos de foto são apagados de vez.
- **Criação de usuários:** a permissão "Alterar RDO's assinados" é definida em "Permissões", depois de criar o usuário.
