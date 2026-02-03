

import React, { useState, useEffect, useRef } from 'react';
import { UserCircleIcon, PencilIcon } from '../components/icons';
import { useQuestionState } from '../contexts/QuestionContext';
import { useSettings } from '../contexts/SettingsContext';

const LS_PROFILE_IMAGE_KEY = 'revApp_userProfileImage';
const IMAGE_SIZE = 256; // Resize to 256x256 px

const StatCard: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
    <div className="bg-bunker-100 dark:bg-bunker-900 p-4 rounded-lg text-center">
        <p className="text-sm text-bunker-500 dark:text-bunker-400">{label}</p>
        <p className="text-3xl font-bold text-sky-500 dark:text-sky-400">{value}</p>
    </div>
);


const ProfileView: React.FC = () => {
    const { settings, updateSettings } = useSettings();
    const [profileImage, setProfileImage] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const questions = useQuestionState();

    useEffect(() => {
        const savedImage = localStorage.getItem(LS_PROFILE_IMAGE_KEY);
        if (savedImage) {
            setProfileImage(savedImage);
        }
    }, []);

    const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            if (typeof e.target?.result !== 'string') return;
            
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                if (!ctx) return;

                canvas.width = IMAGE_SIZE;
                canvas.height = IMAGE_SIZE;

                const sourceSize = Math.min(img.width, img.height);
                const sourceX = (img.width - sourceSize) / 2;
                const sourceY = (img.height - sourceSize) / 2;

                ctx.drawImage(img, sourceX, sourceY, sourceSize, sourceSize, 0, 0, IMAGE_SIZE, IMAGE_SIZE);
                const resizedBase64 = canvas.toDataURL('image/jpeg', 0.9);

                setProfileImage(resizedBase64);
                localStorage.setItem(LS_PROFILE_IMAGE_KEY, resizedBase64);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    };

    const triggerFileInput = () => {
        fileInputRef.current?.click();
    };
    
    const totalQuestions = questions.length;
    const questionsAttempted = questions.filter(q => q.totalAttempts > 0).length;

    return (
        <div className="max-w-2xl mx-auto space-y-8">
            <div className="flex flex-col items-center gap-6">
                <div className="relative group">
                    {profileImage ? (
                        <img 
                            src={profileImage} 
                            alt="Foto de Perfil" 
                            className="w-32 h-32 rounded-full object-cover border-4 border-bunker-200 dark:border-bunker-800 shadow-lg"
                        />
                    ) : (
                        <div className="w-32 h-32 rounded-full bg-bunker-200 dark:bg-bunker-800 flex items-center justify-center text-bunker-400 dark:text-bunker-600">
                            <UserCircleIcon />
                        </div>
                    )}
                    <button 
                        onClick={triggerFileInput}
                        className="absolute inset-0 w-full h-full bg-black/50 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label="Alterar foto de perfil"
                    >
                        <PencilIcon />
                    </button>
                </div>
                
                {/* Editable Name Input */}
                <div className="text-center w-full max-w-xs">
                    <input
                        type="text"
                        value={settings.userName || ''}
                        onChange={(e) => updateSettings({ userName: e.target.value })}
                        placeholder="Seu Nome"
                        className="w-full bg-transparent text-center text-3xl font-bold text-slate-900 dark:text-white border-b-2 border-transparent hover:border-bunker-300 focus:border-sky-500 focus:outline-none transition-all placeholder-bunker-300 dark:placeholder-bunker-700"
                    />
                    <p className="text-bunker-500 dark:text-bunker-400 text-sm mt-2">Toque no nome para editar</p>
                </div>

                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImageChange}
                    accept="image/*"
                    capture="user"
                    className="hidden"
                />
                 <div>
                    <h2 className="text-3xl font-bold text-center text-slate-900 dark:text-white">Seu Perfil</h2>
                    <p className="text-bunker-500 dark:text-bunker-400 text-center">Acompanhe suas estatísticas e gerencie sua conta.</p>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <StatCard label="Total de Questões" value={totalQuestions} />
                <StatCard label="Questões Respondidas" value={questionsAttempted} />
            </div>

             <div className="p-6 bg-bunker-100 dark:bg-bunker-900 rounded-lg space-y-4">
                <h3 className="font-bold text-lg">Gerenciar Foto</h3>
                <div className="flex flex-col sm:flex-row gap-4">
                    <button onClick={triggerFileInput} className="flex-1 bg-sky-500 text-white font-bold py-3 px-4 rounded-lg shadow-md hover:bg-sky-600 transition-colors text-sm">
                        Carregar Nova Foto
                    </button>
                    {profileImage && (
                         <button onClick={() => { setProfileImage(null); localStorage.removeItem(LS_PROFILE_IMAGE_KEY); }} className="flex-1 bg-rose-500/10 text-rose-700 dark:text-rose-300 font-bold py-3 px-4 rounded-lg hover:bg-rose-500/20 transition-colors text-sm">
                            Remover Foto
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ProfileView;