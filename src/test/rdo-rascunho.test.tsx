import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => {
  const inseridos: { tabela: string; valores: unknown }[] = [];
  const atualizados: { tabela: string; valores: unknown }[] = [];
  const permissoes = { valor: true };
  return { inseridos, atualizados, permissoes, sucesso: vi.fn(), erro: vi.fn() };
});
vi.mock('@/components/auth-context', () => ({ usePermissao: () => mock.permissoes.valor }));
vi.mock('sonner', () => ({ toast: { success: mock.sucesso, error: mock.erro } }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: (tabela: string) => {
  const fim = { select: () => ({ single: () => Promise.resolve({ data: { id: 'novo' }, error: null }) }) };
  return {
    insert: (valores: unknown) => { mock.inseridos.push({ tabela, valores }); return fim; },
    update: (valores: unknown) => { mock.atualizados.push({ tabela, valores }); return { eq: () => fim }; },
  };
} } }));
import { ImportarRascunho } from '@/components/rdo/importar-rascunho';
import type { DiaRdo, FrenteBanco, ObraBanco, RdoBanco } from '@/lib/rdo/queries';
import { planejarImportacao, temConteudo, type Rascunho } from '@/lib/rdo/rascunho';
import { chaveLocal } from '@/lib/rdo/rules';

const data = '2026-10-24';
const rdo = { id: 'rdo', numero: 999, data, status: 'aberto', assinado_em: null, clima_manha: 'Bom', clima_tarde: null, clima_noite: null, pluv_07h: 0, pluv_12h: null, pluv_17h: null, mare_max_hora: '09:42:00', mare_max_nivel: 3.16, horario_trabalho: '07:00 às 16:00', assinante_obra: null, assinante_fiscalizacao: null, fotos_no_pdf: true } as RdoBanco;
const obra = { nome: 'Ponte', cliente: 'Governo', endereco: null, contrato: '059', responsavel_tecnico: 'Consórcio', data_inicio: '2024-01-30', prazo_previsto: '2026-09-30' } as ObraBanco;
const frentes = [{ id: 'reto', nome: 'Mártir Reto', ordem: 2, ativa: true }, { id: 'muru', nome: 'Murutucu', ordem: 4, ativa: true }] as FrenteBanco[];
const dia = {
  rdo, maoObra: [], fotos: [],
  equipamentos: [{ id: 'e', descricao: 'ESCAVADEIRA', quantidade: 3 }],
  atividades: [{ id: 'a', frente_id: 'reto', descricao: 'Dragagem' }],
  anotacoes: [{ id: 'n', tipo: 'ocorrencia', texto: 'Chuva  parou a obra' }],
} as unknown as DiaRdo & { rdo: RdoBanco };
const planejar = (r: Rascunho) => planejarImportacao(r, dia, obra, frentes);

beforeEach(() => { mock.inseridos.length = 0; mock.atualizados.length = 0; mock.permissoes.valor = true; vi.clearAllMocks(); localStorage.clear(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('Plano de importação', () => {
  it('não duplica o que já está no RDO, ignorando caixa, acentos e espaços', () => {
    const p = planejar({
      equipamentos: [{ a: 'escavadeira', b: '3' }],
      atividades: [{ a: 'DRAGAGEM', local: 'Mártir Reto' }, { a: 'Dragagem - Mártir Reto', local: 'Mártir Reto' }],
      ocorrencias: 'chuva parou a obra',
    });
    expect(p.equipamentos).toEqual([]);
    expect(p.atividades).toEqual([]);
    expect(p.anotacoes).toEqual([]);
    expect(p.jaExistem).toBe(4);
    expect(temConteudo(p)).toBe(false);
  });
  it('a mesma atividade em outra frente é nova', () => {
    const p = planejar({ atividades: [{ a: 'Dragagem', local: 'Murutucu' }] });
    expect(p.atividades).toEqual([{ frente_id: 'muru', descricao: 'Dragagem' }]);
  });
  it('não substitui: valor diferente só é informado', () => {
    const p = planejar({ horario: '07:00 às 18:00', mareNivel: '2,50', pluvio: { '07:00': '5' }, clima: { Manhã: 'Chuva forte' }, equipamentos: [{ a: 'Escavadeira', b: '5' }] });
    expect(p.campos).toEqual({});
    expect(p.equipamentos).toEqual([]);
    expect(p.diferencas).toEqual(expect.arrayContaining(['Horário de trabalho: 07:00 às 18:00 (no RDO: 07:00 às 16:00)', 'Maré, nível (m): 2,5 (no RDO: 3,16)', 'Precipitação 07:00 (mm): 5 (no RDO: 0)', 'Clima (Manhã): Chuva forte (no RDO: Bom)', 'Equipamento Escavadeira: 5 (no RDO: 3)']));
  });
  it('preenche só o que está vazio', () => {
    const p = planejar({ clima: { Tarde: 'Nublado', Noite: 'Chuva fraca' }, pluvio: { '12:00': '1,5' }, assResp: 'Fulano' });
    expect(p.campos).toEqual({ clima_tarde: 'Nublado', clima_noite: 'Chuva fraca', pluv_12h: 1.5 });
    expect(p.assinaturas).toEqual({ assinante_obra: 'Fulano' });
    expect(p.novos).toContain('Clima (Noite anterior): Chuva fraca');
  });
  it('ignora o que o formulário antigo preenchia sozinho', () => {
    const p = planejar({ clima: { Tarde: 'Bom', Noite: 'Bom' }, horario: '07:00 às 17:00', equipamentos: [{ a: 'Betoneira 400L', b: '1' }] });
    expect(temConteudo(p)).toBe(false);
  });
  it('dados da obra só preenchem campo em branco, sem acusar diferença', () => {
    const p = planejar({ obra: 'Outro nome', cliente: 'Outro', endereco: 'Rua A' });
    expect(p.obra).toEqual({ endereco: 'Rua A' });
    expect(p.diferencas).toEqual([]);
  });
  it('atividade sem local fica de fora e é listada', () => {
    const p = planejar({ atividades: [{ a: 'Serviço novo' }, { a: 'Dragagem' }] });
    expect(p.atividades).toEqual([]);
    expect(p.semLocal).toEqual([{ a: 'Serviço novo' }]);
    expect(p.jaExistem).toBe(1);
  });
});

describe('Aviso de rascunho', () => {
  function montar(rascunho: Rascunho, rdoAtual: RdoBanco = rdo) {
    localStorage.setItem(chaveLocal(data), JSON.stringify(rascunho));
    return render(<QueryClientProvider client={new QueryClient()}><ImportarRascunho date={data} rdo={rdoAtual} dia={{ ...dia, rdo: rdoAtual }} obra={obra} frentes={frentes} /></QueryClientProvider>);
  }
  it('mostra o conteúdo e importa só o que é novo', async () => {
    montar({ ocorrencias: 'Visita da fiscalização', equipamentos: [{ a: 'Escavadeira', b: '3' }, { a: 'Munck', b: '1' }] });
    expect(screen.getByText('Ocorrência: Visita da fiscalização')).toBeInTheDocument();
    expect(screen.getByText('Equipamento: Munck (1)')).toBeInTheDocument();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Importar para o banco' })); });
    await waitFor(() => expect(mock.sucesso).toHaveBeenCalled());
    expect(mock.inseridos).toEqual([
      { tabela: 'equipamentos', valores: { rdo_id: 'rdo', descricao: 'Munck', quantidade: 1 } },
      { tabela: 'anotacoes', valores: { rdo_id: 'rdo', tipo: 'ocorrencia', texto: 'Visita da fiscalização' } },
    ]);
    expect(localStorage.getItem(chaveLocal(data))).toBeNull();
  });
  it('rascunho sem nada novo some sozinho e limpa o navegador', async () => {
    const { container } = montar({ ocorrencias: 'Chuva parou a obra' });
    await waitFor(() => expect(localStorage.getItem(chaveLocal(data))).toBeNull());
    expect(container).toBeEmptyDOMElement();
    expect(mock.inseridos).toEqual([]);
  });
  it('só diferença oferece apenas descartar', () => {
    montar({ mareNivel: '2,50' });
    expect(screen.getByText('Diferente do RDO (não será alterado):')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Importar para o banco' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Descartar' })).toBeEnabled();
  });
  it('RDO travado bloqueia importar, mas permite descartar', () => {
    mock.permissoes.valor = false;
    montar({ ocorrencias: 'Visita da fiscalização' }, { ...rdo, status: 'fechado' });
    expect(screen.getByRole('button', { name: 'Importar para o banco' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Descartar' })).toBeEnabled();
  });
  it('descartar pede confirmação e não toca no banco', () => {
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { container } = montar({ ocorrencias: 'Visita da fiscalização' });
    fireEvent.click(screen.getByRole('button', { name: 'Descartar' }));
    expect(localStorage.getItem(chaveLocal(data))).not.toBeNull();
    confirmar.mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Descartar' }));
    expect(localStorage.getItem(chaveLocal(data))).toBeNull();
    expect(container).toBeEmptyDOMElement();
    expect(mock.inseridos).toEqual([]);
    expect(mock.atualizados).toEqual([]);
  });
});
