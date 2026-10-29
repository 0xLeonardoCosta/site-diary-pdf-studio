# Dias, histórico e mão de obra

## Escopo
Implementar somente os três itens do documento, usando o Supabase existente sem alterar tabelas, regras, funções ou arquivos de migração.

### A — Número e data ligados
- Carregar a referência da obra e ligar os campos número/data com as funções fornecidas.
- Abrir hoje por padrão; mostrar o RDO existente ou o aviso de dia sem RDO e botão de criação.
- Criar enviando somente a data. Confirmar dias futuros e mudanças de data; respeitar permissões e apresentar os erros previstos.

### B — Dias e histórico
- Usar `/rdo/AAAA-MM-DD`, com anterior, próximo, Hoje e escolha de data; `/` encaminha para hoje.
- Adicionar Histórico de RDOs ao menu: 30 registros por vez, filtro por mês, busca por número, status e efetivo.
- Exibir somente os registros que o Supabase permitir consultar.
- Guardar as demais seções no navegador por data, usando `rdo-local-AAAA-MM-DD`, sem migrá-las para o banco nem modificar seus campos.

### C — Mão de obra
- Substituir a classificação antiga por Direto, Indireto e Terceirizado, com funções, quantidades, subtotais e total.
- Ler e salvar no Supabase; salvar ao sair do campo, indicar o resultado e reverter mudanças quando houver erro.
- Validar quantidades inteiras não negativas e confirmar funções repetidas na mesma categoria.
- Aplicar modo leitura conforme permissões e status fechado.
- Atualizar somente a mão de obra do PDF, sem autoria e sem importar os dados antigos do navegador.

## Organização e verificação
Executar em três etapas correspondentes a A, B e C, mantendo a lista de tarefas atualizada para facilitar uma retomada.
Testar as conversões com os exemplos 1000, 1002 e 1007, datas inválidas, dias vizinhos, quantidades e totais; conferir navegação e apresentação.
As verificações autenticadas completas dependem de uma sessão disponível no Supabase externo; não serão apresentadas como concluídas sem essa evidência.

## Detalhes técnicos
- Manter todas as páginas novas dentro do layout autenticado e consumir o cliente público Supabase gerado, sem cliente privilegiado.
- Separar funções de datas, consultas e mão de obra em módulos focados; usar cache de consultas para referência, RDO e histórico.
- Buscar mão de obra do histórico com um único `.in('rdo_id', ids)` por lote.
- Enviar apenas `{ data }` para criação do RDO mesmo que os tipos gerados ainda tratem `numero` como obrigatório; não modificar os tipos gerados.
- Não tratar falha de consulta como dia sem RDO; mostrar erro e opção de tentar novamente.
- Impedir que mudanças de dia salvem o conteúdo anterior na chave do novo dia.