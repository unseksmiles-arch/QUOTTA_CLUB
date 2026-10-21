'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/browser';
import { useRouter } from 'next/navigation';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { error: authError } = await createClient().auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (authError) {
        const message = authError.message;
        const code = authError.code ?? 'sem_codigo';
        setError(`Supabase: ${message} (codigo: ${code}; HTTP ${authError.status ?? '?'})`);
        return;
      }
      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      setError(`Erro de conexao com Supabase: ${err instanceof Error ? err.message : 'erro desconhecido'}`);
    } finally {
      setBusy(false);
    }
  }

  return <main className="wrap" style={{maxWidth:480}}>
    <h1>QUOTTA</h1>
    <p className="muted">Entre com seu acesso cadastrado pela administradora.</p>
    <form className="panel" onSubmit={submit}>
      <label htmlFor="email">E-mail</label>
      <input id="email" type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}/>
      <label htmlFor="password">Senha</label>
      <input id="password" type="password" required autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/>
      {error && <p role="alert" style={{overflowWrap:'anywhere'}}>{error}</p>}
      <button disabled={busy}>{busy?'Entrando...':'Entrar'}</button>
    </form>
  </main>;
}
