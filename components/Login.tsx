import React, { useState } from 'react';
import { db } from '../services/db';
import { User } from '../types';
import { Loader2, AlertCircle, Lock, Mail, User as UserIcon, Shield, ArrowLeft, Building2 } from 'lucide-react';

interface LoginProps {
  onLogin: (user: User) => void;
}

type ViewMode = 'LOGIN' | 'REGISTER' | 'FORGOT';

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [view, setView] = useState<ViewMode>('LOGIN');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Registration extras
  const [regName, setRegName] = useState('');
  const [regEnterpriseName, setRegEnterpriseName] = useState('Condomínio Assembleia 66');
  const [regConfirmPass, setRegConfirmPass] = useState('');
  const [accessCode, setAccessCode] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const user = await db.login(email.trim().toLowerCase(), password);
      if (user) {
        onLogin(user);
      } else {
        setError("Credenciais inválidas. Verifique e-mail e senha.");
      }
    } catch (err) {
      setError("Erro ao conectar.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // Validate Code
    if (accessCode !== '3382') {
      setError("Código de acesso inválido. Contate o suporte.");
      return;
    }
    
    if (password !== regConfirmPass) {
      setError("As senhas não conferem.");
      return;
    }

    if (password.length < 6) {
      setError("A senha deve ter no mínimo 6 caracteres.");
      return;
    }

    setLoading(true);
    const result = await db.registerSystemUser(regName, email, password, regEnterpriseName);
    setLoading(false);

    if (result.success) {
      setSuccessMsg(result.message);
      setTimeout(() => {
        setSuccessMsg('');
        setView('LOGIN');
      }, 3000);
    } else {
      setError(result.message);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const exists = await db.resetPasswordRequest(email);
    setLoading(false);
    
    // Always show success message for security (don't reveal if email exists)
    setSuccessMsg("Se o e-mail estiver cadastrado, você receberá um link de recuperação em instantes.");
    setTimeout(() => {
      setSuccessMsg('');
      setView('LOGIN');
    }, 5000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4 font-inter">
      <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md text-center relative overflow-hidden">
        
        {view === 'LOGIN' && (
          <div className="animate-fade-in">
            <div className="mb-8">
              <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-cyan-500">
                SindGestor
              </h1>
              <p className="text-slate-500 mt-2">Plataforma Multi-Condomínio</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4 text-left">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">E-mail</label>
                <div className="relative">
                  <input type="email" required className="w-full p-3 pl-10 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" />
                  <Mail className="absolute left-3 top-3 text-slate-400" size={18} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Senha</label>
                <div className="relative">
                  <input type="password" required className="w-full p-3 pl-10 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••" />
                  <Lock className="absolute left-3 top-3 text-slate-400" size={18} />
                </div>
                <div className="text-right mt-1">
                  <button type="button" onClick={() => setView('FORGOT')} className="text-xs text-blue-600 hover:underline">Esqueceu a senha?</button>
                </div>
              </div>

              {error && <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg flex gap-2"><AlertCircle size={16} className="shrink-0 mt-0.5"/><span>{error}</span></div>}
              {successMsg && <div className="p-3 bg-green-50 text-green-600 text-sm rounded-lg">{successMsg}</div>}

              <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition flex items-center justify-center gap-2 disabled:opacity-70">
                {loading ? <Loader2 className="animate-spin" /> : 'Entrar'}
              </button>
            </form>
            
            <div className="mt-6 pt-6 border-t border-slate-100">
              <p className="text-sm text-slate-500">Novo por aqui?</p>
              <button onClick={() => setView('REGISTER')} className="text-blue-600 font-bold hover:underline mt-1">Criar nova conta de administrador</button>
            </div>
          </div>
        )}

        {view === 'REGISTER' && (
          <div className="animate-fade-in text-left">
             <button onClick={() => setView('LOGIN')} className="mb-4 text-slate-500 hover:text-slate-800 flex items-center gap-1 text-sm"><ArrowLeft size={16}/> Voltar para Login</button>
             <h2 className="text-2xl font-bold text-slate-800 mb-2">Criar Conta</h2>
             <p className="text-slate-500 text-sm mb-6">Cadastre-se para gerenciar seu condomínio.</p>

             <form onSubmit={handleRegister} className="space-y-4">
               <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome Completo</label>
                  <div className="relative">
                    <input type="text" required className="w-full p-2 pl-9 border border-slate-300 rounded-lg" value={regName} onChange={e => setRegName(e.target.value)} />
                    <UserIcon className="absolute left-2.5 top-2.5 text-slate-400" size={16} />
                  </div>
               </div>
               
               <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">E-mail</label>
                  <div className="relative">
                    <input type="email" required className="w-full p-2 pl-9 border border-slate-300 rounded-lg" value={email} onChange={e => setEmail(e.target.value)} />
                    <Mail className="absolute left-2.5 top-2.5 text-slate-400" size={16} />
                  </div>
               </div>

               <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome do Condomínio</label>
                  <div className="relative">
                    <input type="text" required className="w-full p-2 pl-9 border border-slate-300 rounded-lg" placeholder="Ex: Condomínio Assembleia 66" value={regEnterpriseName} onChange={e => setRegEnterpriseName(e.target.value)} />
                    <Building2 className="absolute left-2.5 top-2.5 text-slate-400" size={16} />
                  </div>
               </div>

               <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Senha</label>
                    <input type="password" required className="w-full p-2 border border-slate-300 rounded-lg" value={password} onChange={e => setPassword(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Confirmar</label>
                    <input type="password" required className="w-full p-2 border border-slate-300 rounded-lg" value={regConfirmPass} onChange={e => setRegConfirmPass(e.target.value)} />
                  </div>
               </div>

               <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Código de Acesso</label>
                  <div className="relative">
                    <input type="text" required className="w-full p-2 pl-9 border border-slate-300 rounded-lg" placeholder="Código de 4 dígitos" value={accessCode} onChange={e => setAccessCode(e.target.value)} maxLength={4} />
                    <Shield className="absolute left-2.5 top-2.5 text-slate-400" size={16} />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">Este código é fornecido pela administração do sistema.</p>
               </div>

               {error && <div className="p-2 bg-red-50 text-red-600 text-xs rounded-lg">{error}</div>}

               <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition flex items-center justify-center gap-2 mt-4 disabled:opacity-70">
                {loading ? <Loader2 className="animate-spin" /> : 'Registrar'}
              </button>
             </form>
          </div>
        )}

        {view === 'FORGOT' && (
          <div className="animate-fade-in text-left">
             <button onClick={() => setView('LOGIN')} className="mb-4 text-slate-500 hover:text-slate-800 flex items-center gap-1 text-sm"><ArrowLeft size={16}/> Voltar para Login</button>
             <h2 className="text-2xl font-bold text-slate-800 mb-2">Recuperar Senha</h2>
             <p className="text-slate-500 text-sm mb-6">Informe seu e-mail para receber as instruções.</p>

             <form onSubmit={handleForgot} className="space-y-4">
               <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">E-mail Cadastrado</label>
                  <div className="relative">
                    <input type="email" required className="w-full p-3 pl-10 border border-slate-300 rounded-lg" value={email} onChange={e => setEmail(e.target.value)} />
                    <Mail className="absolute left-3 top-3 text-slate-400" size={18} />
                  </div>
               </div>

               {successMsg && <div className="p-3 bg-green-50 text-green-700 text-sm rounded-lg">{successMsg}</div>}

               <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition flex items-center justify-center gap-2 disabled:opacity-70">
                {loading ? <Loader2 className="animate-spin" /> : 'Enviar Link'}
              </button>
             </form>
          </div>
        )}

      </div>
    </div>
  );
};