import { describe, expect, it } from 'vitest';
import { nomeParaEmail, pode, permissoesVazias, senhaValida, PERMISSOES, type Perfil } from '@/lib/auth-rules';

const perfil = (overrides: Partial<Perfil> = {}): Perfil => ({
  id: 'usuario', nome: 'Eng Leo', role: 'preenchedor', ativo: true,
  criado_em: '2026-10-28', ...permissoesVazias(), ...overrides,
});
describe('Regras de acesso existentes', () => {
  it('converte o nome com o domínio e normalização exigidos', () => {
    expect(nomeParaEmail('  João Ávila / Costa  ')).toBe('joao.avila.costa@diario.example.com');
  });
  it('permite todas as permissões para admin ativo', () => {
    const admin = perfil({ role: 'admin' });
    for (const key of Object.keys(PERMISSOES) as (keyof typeof PERMISSOES)[]) expect(pode(admin, key)).toBe(true);
  });
  it('nega permissões para conta inativa inclusive admin', () => {
    expect(pode(perfil({ role: 'admin', ativo: false }), 'lancar_clima')).toBe(false);
  });
  it('respeita o booleano do usuário não administrador', () => {
    expect(pode(perfil(), 'lancar_clima')).toBe(false);
    expect(pode(perfil({ lancar_clima: true }), 'lancar_clima')).toBe(true);
  });
  it('exige senha mínima de oito caracteres', () => {
    expect(senhaValida('1234567')).toBe(false);
    expect(senhaValida('12345678')).toBe(true);
  });
});