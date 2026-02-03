
import React, { useEffect, useState } from 'react';
import { TabID } from '../types';
import { 
    ArrowRightIcon, 
    BrainIcon, 
    ChevronDownIcon, 
    XCircleIcon, 
    ClockIcon, 
    CheckCircleIcon, 
    PuzzlePieceIcon, 
    ScaleIcon, 
    LightningIcon,
    ExclamationTriangleIcon,
    MapIcon,
    ChartBarIcon,
    GraphIcon,
    SparklesIcon
} from '../components/icons';

interface SplashKpis {
  questionsDone: number;
  questionsDoneToday: number;
  accuracy: number;
  lastTrail: {
    subject: string;
    count: number;
    bank: string;
  };
  lastSessions: {
    subject: string;
    date: string;
    total: number;
    correct: number;
  }[];
}

interface SplashViewProps {
  onStartApp: (initialTab?: TabID) => void;
  kpis: SplashKpis;
  onOpenSyncModal: () => void;
}

const CatMascot = () => (
    <div className="relative w-48 h-48 md:w-64 md:h-64 mb-8 animate-float">
        {/* Glow effect behind */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 bg-indigo-500/30 rounded-full blur-[50px]"></div>

        <svg viewBox="0 0 200 200" className="w-full h-full drop-shadow-2xl relative z-10">
            {/* Bubble - Glass effect */}
            <circle cx="100" cy="100" r="90" fill="url(#bubbleGrad)" stroke="rgba(255, 255, 255, 0.3)" strokeWidth="1" />
            <defs>
                <linearGradient id="bubbleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="rgba(255,255,255,0.1)" />
                    <stop offset="100%" stopColor="rgba(255,255,255,0.02)" />
                </linearGradient>
            </defs>

            {/* Glare */}
            <ellipse cx="70" cy="60" rx="15" ry="8" fill="rgba(255,255,255,0.2)" transform="rotate(-45 70 60)" />

            {/* Cat Face */}
            <g transform="translate(0, 15)">
                {/* Head Shape */}
                <path d="M50 120 C 50 70, 150 70, 150 120 C 150 145, 125 155, 100 155 C 75 155, 50 145, 50 120 Z" fill="#f97316" />
                
                {/* Ears */}
                <path d="M50 85 L40 55 L75 75 Z" fill="#f97316" stroke="#ea580c" strokeWidth="2" strokeLinejoin="round" />
                <path d="M150 85 L160 55 L125 75 Z" fill="#f97316" stroke="#ea580c" strokeWidth="2" strokeLinejoin="round" />
                <path d="M55 83 L48 65 L68 78 Z" fill="#fb923c" />
                <path d="M145 83 L152 65 L132 78 Z" fill="#fb923c" />
                
                {/* Eyes */}
                <circle cx="80" cy="105" r="12" fill="#0f172a" />
                <circle cx="120" cy="105" r="12" fill="#0f172a" />
                <circle cx="84" cy="100" r="4" fill="white" />
                <circle cx="124" cy="100" r="4" fill="white" />

                {/* Nose */}
                <path d="M96 122 L 104 122 L 100 128 Z" fill="#fda4af" />

                {/* Mouth */}
                <path d="M100 128 Q 90 135, 85 130" stroke="#4b5563" strokeWidth="2" fill="none" strokeLinecap="round" />
                <path d="M100 128 Q 110 135, 115 130" stroke="#4b5563" strokeWidth="2" fill="none" strokeLinecap="round" />
                
                {/* Whiskers */}
                <g stroke="#4b5563" strokeWidth="1.5" strokeLinecap="round" opacity="0.6">
                    <path d="M85 118 L 60 115" />
                    <path d="M85 124 L 60 126" />
                    <path d="M115 118 L 140 115" />
                    <path d="M115 124 L 140 126" />
                </g>
            </g>
        </svg>
    </div>
);

const StatBadge: React.FC<{ label: string; value: string | number; color: string }> = ({ label, value, color }) => (
    <div className="flex flex-col items-center p-3 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-sm min-w-[90px]">
        <span className={`text-xl font-black ${color}`}>{value}</span>
        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{label}</span>
    </div>
);

const MethodCard: React.FC<{ icon: React.ReactNode; title: string; text: string }> = ({ icon, title, text }) => (
    <div className="bg-slate-900/40 border border-white/5 p-6 rounded-3xl hover:bg-slate-900/60 transition-colors group">
        <div className="mb-4 p-3 bg-white/5 rounded-2xl w-fit text-sky-500 group-hover:scale-110 transition-transform group-hover:text-sky-400 group-hover:bg-sky-500/10">
            {icon}
        </div>
        <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
        <p className="text-sm text-slate-400 leading-relaxed">{text}</p>
    </div>
);

const SplashView: React.FC<SplashViewProps> = ({ onStartApp, kpis }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Force dark mode context
    document.documentElement.classList.add('dark');
    return () => {
       // Cleanup if needed, though app is generally dark
    };
  }, []);

  const hasProgress = kpis && kpis.questionsDone > 0;

  return (
    <div className="fixed inset-0 z-[100] bg-[#020617] text-slate-100 overflow-y-auto overflow-x-hidden selection:bg-indigo-500/30">
      
      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none">
          <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] bg-indigo-900/20 blur-[150px] rounded-full animate-pulse-slow"></div>
          <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-sky-900/10 blur-[150px] rounded-full animate-pulse-slow" style={{ animationDelay: '2s' }}></div>
          <div className="absolute top-[40%] left-[50%] w-[40%] h-[40%] bg-violet-900/10 blur-[120px] rounded-full -translate-x-1/2"></div>
          {/* Stars */}
          <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(1px 1px at 20px 30px, #fff, rgba(0,0,0,0)), radial-gradient(1px 1px at 40px 70px, #fff, rgba(0,0,0,0)), radial-gradient(1px 1px at 50px 160px, #fff, rgba(0,0,0,0)), radial-gradient(1.5px 1.5px at 90px 40px, #fff, rgba(0,0,0,0)), radial-gradient(2px 2px at 130px 80px, #fff, rgba(0,0,0,0))', backgroundSize: '200px 200px' }}></div>
      </div>

      <div className={`relative min-h-screen flex flex-col items-center justify-center p-6 transition-opacity duration-1000 ${mounted ? 'opacity-100' : 'opacity-0'}`}>
          
          <main className="w-full max-w-md flex flex-col items-center text-center z-10 py-10">
            <CatMascot />

            <div className="mb-8 space-y-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 mb-2">
                    <SparklesIcon className="w-3 h-3 text-yellow-400" />
                    <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Revisão Inteligente v17.0</span>
                </div>
                <h1 className="text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white via-slate-200 to-slate-500 tracking-tighter">
                    MIAAULA
                </h1>
                <p className="text-slate-400 text-lg font-medium max-w-xs mx-auto leading-relaxed">
                    Menos horas estudadas.<br/>Mais questões acertadas.
                </p>
            </div>

            {hasProgress && (
              <div className="grid grid-cols-3 gap-3 w-full mb-8 animate-fade-in-up">
                  <StatBadge label="Revisadas" value={kpis.questionsDone} color="text-sky-400" />
                  <StatBadge label="Hoje" value={kpis.questionsDoneToday} color="text-white" />
                  <StatBadge label="Acurácia" value={`${kpis.accuracy.toFixed(0)}%`} color="text-emerald-400" />
              </div>
            )}

            <div className="w-full space-y-4 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
                <button
                    onClick={() => onStartApp('today')}
                    className="group relative w-full bg-slate-100 hover:bg-white text-slate-950 font-black text-lg py-5 px-8 rounded-2xl shadow-[0_0_40px_-10px_rgba(255,255,255,0.3)] hover:shadow-[0_0_60px_-15px_rgba(255,255,255,0.5)] transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3 overflow-hidden"
                >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent -translate-x-full group-hover:animate-shimmer"></div>
                    <BrainIcon className="w-6 h-6 text-indigo-600" />
                    <span className="tracking-widest uppercase">{hasProgress ? 'CONTINUAR' : 'COMEÇAR AGORA'}</span>
                    <ArrowRightIcon className="w-5 h-5 text-indigo-600 group-hover:translate-x-1 transition-transform" />
                </button>
                
                {!hasProgress && (
                    <button 
                        onClick={() => onStartApp('today')}
                        className="text-xs font-bold text-slate-500 hover:text-slate-300 uppercase tracking-widest py-2 transition-colors"
                    >
                        Entrar como Visitante
                    </button>
                )}
            </div>
          </main>

          <div 
            className="absolute bottom-6 flex flex-col items-center gap-2 cursor-pointer text-slate-500 hover:text-white transition-colors opacity-60 hover:opacity-100 animate-bounce"
            onClick={() => window.scrollBy({ top: window.innerHeight, behavior: 'smooth' })}
          >
              <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Como Funciona</span>
              <ChevronDownIcon className="w-5 h-5" />
          </div>
      </div>

      {/* Info Section */}
      <div className="relative bg-slate-950 border-t border-white/5 py-24 px-6 z-10">
          <div className="max-w-5xl mx-auto">
              <div className="text-center mb-16">
                  <h2 className="text-3xl md:text-5xl font-black text-white mb-6 tracking-tight">Pare de estudar errado.</h2>
                  <p className="text-lg text-slate-400 max-w-2xl mx-auto">
                      A curva de esquecimento destrói 50% do seu estudo em 24h. O Miaaula usa algoritmos para garantir que você só revise o que está prestes a esquecer.
                  </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <MethodCard 
                      icon={<ClockIcon className="w-6 h-6" />}
                      title="Repetição Espaçada"
                      text="O algoritmo SRS agenda suas revisões no momento exato, maximizando a retenção com o mínimo de esforço."
                  />
                  <MethodCard 
                      icon={<ScaleIcon className="w-6 h-6" />}
                      title="Lei Seca Ativa"
                      text="Transformamos a leitura passiva em lacunas e flashcards ativos. Você é forçado a lembrar, não apenas ler."
                  />
                  <MethodCard 
                      icon={<MapIcon className="w-6 h-6" />}
                      title="Mapeamento Orbital"
                      text="Visualize seu conhecimento como um universo. Identifique buracos negros (erros) e supernovas (domínio)."
                  />
                  <MethodCard 
                      icon={<PuzzlePieceIcon className="w-6 h-6" />}
                      title="Gamificação Real"
                      text="Batalhas, combos e XP. Transformamos a dor da revisão em dopamina produtiva."
                  />
                  <MethodCard 
                      icon={<LightningIcon className="w-6 h-6" />}
                      title="Modo Porrada"
                      text="Sessões de alta intensidade para ganhar velocidade e confiança para o dia da prova."
                  />
                  <MethodCard 
                      icon={<ChartBarIcon className="w-6 h-6" />}
                      title="Métricas de Elite"
                      text="Não medimos horas bunda-cadeira. Medimos probabilidade real de acerto na prova."
                  />
              </div>

              <div className="mt-24 text-center">
                  <button 
                      onClick={() => onStartApp('study')}
                      className="inline-flex items-center gap-3 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-lg py-5 px-10 rounded-2xl shadow-xl hover:shadow-indigo-500/20 transition-all transform hover:-translate-y-1"
                  >
                      <BrainIcon className="w-6 h-6" />
                      ACESSAR SISTEMA
                  </button>
              </div>
          </div>
      </div>
    </div>
  );
};

export default SplashView;
