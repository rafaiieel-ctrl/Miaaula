import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';

const SupabaseTestView: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [logs, setLogs] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);

    const addLog = (msg: string, data?: any) => {
        const time = new Date().toLocaleTimeString();
        const json = data ? `\n${JSON.stringify(data, null, 2)}` : '';
        setLogs(prev => [`[${time}] ${msg}${json}`, ...prev]);
    };

    const handleSignUp = async () => {
        setLoading(true);
        try {
            addLog(`Signing up with ${email}...`);
            const { data, error } = await supabase.auth.signUp({ email, password });
            if (error) throw error;
            addLog('Sign Up Success:', data);
        } catch (e: any) {
            addLog('Sign Up Error:', e.message || e);
        } finally {
            setLoading(false);
        }
    };

    const handleSignIn = async () => {
        setLoading(true);
        try {
            addLog(`Signing in with ${email}...`);
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
            addLog('Sign In Success:', data);
        } catch (e: any) {
            addLog('Sign In Error:', e.message || e);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveBackup = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            
            if (!user) {
                addLog('Error: Não há usuário logado. Faça login primeiro.');
                return;
            }

            addLog(`Upserting data for user ${user.id} to 'user_state'...`);

            // Using 'any' bypass to avoid TS build errors if DB types aren't generated yet
            const payload = { 
                user_id: user.id, 
                data: { hello: "world", ts: new Date().toISOString(), agent: navigator.userAgent } 
            };

            const { data, error } = await supabase
                .from('user_state')
                .upsert(payload, { onConflict: 'user_id' })
                .select();

            if (error) throw error;
            addLog('Save Backup Success:', data);

        } catch (e: any) {
            addLog('Save Backup Error:', e.message || e);
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        addLog('Logged out.');
    };

    return (
        <div className="min-h-screen bg-slate-100 text-slate-900 p-8 font-sans">
            <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-xl border border-slate-300 overflow-hidden">
                <div className="bg-slate-900 text-white p-6">
                    <h1 className="text-2xl font-bold">Supabase Connection Test</h1>
                    <p className="text-slate-400 text-sm mt-1">Ambiente isolado de teste de banco de dados.</p>
                </div>
                
                <div className="p-6 space-y-6">
                    {/* Inputs */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold mb-1 text-slate-700">Email</label>
                            <input 
                                className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                placeholder="usuario@teste.com"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold mb-1 text-slate-700">Senha</label>
                            <input 
                                className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder="******"
                            />
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap gap-3 pb-6 border-b border-slate-200">
                        <button 
                            onClick={handleSignUp} 
                            disabled={loading}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors"
                        >
                            Sign Up
                        </button>
                        <button 
                            onClick={handleSignIn} 
                            disabled={loading}
                            className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                        >
                            Sign In
                        </button>
                        <button 
                            onClick={handleSaveBackup} 
                            disabled={loading}
                            className="px-4 py-2 bg-purple-600 text-white rounded-lg font-bold hover:bg-purple-700 disabled:opacity-50 transition-colors"
                        >
                            Save test backup
                        </button>
                        <button 
                            onClick={handleLogout} 
                            className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg font-bold hover:bg-slate-300 transition-colors ml-auto"
                        >
                            Logout
                        </button>
                    </div>

                    {/* Logs */}
                    <div>
                        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-2">Logs do Console</h3>
                        <div className="bg-slate-950 text-emerald-400 p-4 rounded-lg h-80 overflow-y-auto font-mono text-xs border border-slate-800 shadow-inner">
                            {logs.length === 0 ? (
                                <span className="opacity-50 italic">Aguardando ações...</span>
                            ) : (
                                logs.map((log, i) => (
                                    <div key={i} className="mb-3 border-b border-slate-800/50 pb-2 last:border-0 last:pb-0">
                                        <pre className="whitespace-pre-wrap break-all">{log}</pre>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SupabaseTestView;