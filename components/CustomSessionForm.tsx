

import React, { useState, useMemo } from 'react';
import { Question, PriorityLevel } from '../types';
import { FilterIcon, ChevronDownIcon } from './icons';
import { useSettings } from '../contexts/SettingsContext';

interface CustomSessionFormProps {
  dueQuestions: Question[];
  onStartCustomSession: (filteredQuestions: Question[]) => void;
}

type StatusFilter = 'incorrect' | 'hot' | 'critical';

interface Filters {
  subjects: Set<string>;
  topics: Set<string>;
  banks: Set<string>;
  positions: Set<string>;
  types: Set<string>;
  areas: Set<string>;
  statuses: Set<StatusFilter>;
  priorities: Set<PriorityLevel>;
}

const FilterCheckboxList: React.FC<{
    title: string;
    items: { value: string, label: string }[];
    selectedItems: Set<string>;
    onToggle: (value: string) => void;
}> = ({ title, items, selectedItems, onToggle }) => {
    if (items.length === 0) return null;
    return (
        <details className="group">
            <summary className="flex justify-between items-center cursor-pointer p-2 rounded-lg hover:bg-bunker-100/50 dark:hover:bg-bunker-800/50">
                <span className="font-semibold">{title}</span>
                <div className="transition-transform group-open:rotate-180">
                    <ChevronDownIcon />
                </div>
            </summary>
            <div className="pl-4 pt-2 max-h-48 overflow-y-auto space-y-2">
                {items.map(item => (
                    <label key={item.value} className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={selectedItems.has(item.value)}
                            onChange={() => onToggle(item.value)}
                            className="h-4 w-4 rounded border-gray-300 text-sky-600 focus:ring-sky-500"
                        />
                        <span className="text-sm">{item.label}</span>
                    </label>
                ))}
            </div>
        </details>
    );
};

const CustomSessionForm: React.FC<CustomSessionFormProps> = ({ dueQuestions, onStartCustomSession }) => {
  const { settings } = useSettings();
  const [filters, setFilters] = useState<Filters>({
    subjects: new Set(),
    topics: new Set(),
    banks: new Set(),
    positions: new Set(),
    types: new Set(),
    areas: new Set(),
    statuses: new Set(),
    priorities: new Set(),
  });

  const uniqueValues = useMemo(() => {
    const subjects = new Set<string>();
    const topics = new Set<string>();
    const types = new Set<string>();
    const banks = new Set<string>();
    const positions = new Set<string>();
    const areas = new Set<string>();

    dueQuestions.forEach(q => {
      // Skip if frozen (double check, although dueQuestions should be pre-filtered now)
      if (settings.subjectConfigs && settings.subjectConfigs[q.subject]?.isFrozen) return;

      if (q.subject) subjects.add(q.subject);
      if (q.topic) topics.add(q.topic);
      if (q.questionType) types.add(q.questionType);
      if (q.bank) banks.add(q.bank);
      if (q.position) positions.add(q.position);
      if (q.area) areas.add(q.area);
    });

    return {
      subjects: Array.from(subjects).sort(),
      topics: Array.from(topics).sort(),
      types: Array.from(types).sort(),
      banks: Array.from(banks).sort(),
      positions: Array.from(positions).sort(),
      areas: Array.from(areas).sort(),
    };
  }, [dueQuestions, settings]);

  const filteredQuestions = useMemo(() => {
    if (
      filters.subjects.size === 0 &&
      filters.topics.size === 0 &&
      filters.types.size === 0 &&
      filters.statuses.size === 0 &&
      filters.banks.size === 0 &&
      filters.positions.size === 0 &&
      filters.areas.size === 0 &&
      filters.priorities.size === 0
    ) {
      return [];
    }

    return dueQuestions.filter(q => {
      // Frozen check
      if (settings.subjectConfigs && settings.subjectConfigs[q.subject]?.isFrozen) return false;

      const subjectMatch = filters.subjects.size === 0 || filters.subjects.has(q.subject);
      const topicMatch = filters.topics.size === 0 || filters.topics.has(q.topic);
      const bankMatch = filters.banks.size === 0 || filters.banks.has(q.bank);
      const positionMatch = filters.positions.size === 0 || filters.positions.has(q.position);
      const typeMatch = filters.types.size === 0 || filters.types.has(q.questionType || 'Não Definido');
      const areaMatch = filters.areas.size === 0 || filters.areas.has(q.area || '');
      
      const statusMatch = filters.statuses.size === 0 || Array.from(filters.statuses).some(status => {
        if (status === 'incorrect') return !q.lastWasCorrect && q.totalAttempts > 0;
        if (status === 'hot') return q.hotTopic;
        if (status === 'critical') return q.isCritical;
        return false;
      });
      
      let priority: PriorityLevel = 'medium';
      if (settings.subjectConfigs && settings.subjectConfigs[q.subject]) {
          priority = settings.subjectConfigs[q.subject].priority;
      }
      const priorityMatch = filters.priorities.size === 0 || filters.priorities.has(priority);

      return subjectMatch && topicMatch && typeMatch && statusMatch && bankMatch && positionMatch && areaMatch && priorityMatch;
    });
  }, [filters, dueQuestions, settings]);

  const handleToggle = (category: keyof Filters, value: string) => {
    setFilters(prev => {
      const newSet = new Set(prev[category] as Set<string>);
      if (newSet.has(value)) {
        newSet.delete(value);
      } else {
        newSet.add(value);
      }
      return { ...prev, [category]: newSet };
    });
  };
  
  const statusItems: { value: StatusFilter, label: string }[] = [
    { value: 'incorrect', label: 'Erradas ❌' },
    { value: 'hot', label: 'Quentes 🔥' },
    { value: 'critical', label: 'Com Atenção ⚠️' },
  ];
  
  const priorityItems: { value: PriorityLevel, label: string }[] = [
    { value: 'high', label: 'Alta Prioridade' },
    { value: 'medium', label: 'Média Prioridade' },
    { value: 'low', label: 'Baixa Prioridade' },
  ];

  return (
    <div className="p-6 bg-bunker-100 dark:bg-bunker-900 rounded-lg space-y-4">
      <div className="flex items-center gap-2">
        <div className="text-sky-500"><FilterIcon/></div>
        <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Sessão Personalizada</h2>
            <p className="text-bunker-500 dark:text-bunker-400">
                Crie uma sessão de estudo focada. Mescle disciplinas, tópicos e outros critérios.
            </p>
        </div>
      </div>
      
      <div className="space-y-2 p-2 border border-bunker-200 dark:border-bunker-800 rounded-lg">
          <FilterCheckboxList 
            title="Prioridade da Disciplina"
            items={priorityItems}
            selectedItems={filters.priorities as unknown as Set<string>}
            onToggle={(value) => handleToggle('priorities', value)}
          />
          <FilterCheckboxList 
            title="Disciplinas"
            items={uniqueValues.subjects.map(s => ({ value: s, label: s }))}
            selectedItems={filters.subjects}
            onToggle={(value) => handleToggle('subjects', value)}
          />
          <FilterCheckboxList 
            title="Tópicos"
            items={uniqueValues.topics.map(t => ({ value: t, label: t }))}
            selectedItems={filters.topics}
            onToggle={(value) => handleToggle('topics', value)}
          />
           <FilterCheckboxList 
            title="Áreas"
            items={uniqueValues.areas.map(a => ({ value: a, label: a }))}
            selectedItems={filters.areas}
            onToggle={(value) => handleToggle('areas', value)}
          />
          <FilterCheckboxList 
            title="Banca"
            items={uniqueValues.banks.map(b => ({ value: b, label: b }))}
            selectedItems={filters.banks}
            onToggle={(value) => handleToggle('banks', value)}
          />
          <FilterCheckboxList 
            title="Prova/Cargo"
            items={uniqueValues.positions.map(p => ({ value: p, label: p }))}
            selectedItems={filters.positions}
            onToggle={(value) => handleToggle('positions', value)}
          />
          <FilterCheckboxList 
            title="Tipos de Questão"
            items={uniqueValues.types.map(t => ({ value: t, label: t }))}
            selectedItems={filters.types}
            onToggle={(value) => handleToggle('types', value)}
          />
          <FilterCheckboxList 
            title="Status"
            items={statusItems}
            selectedItems={filters.statuses as Set<string>}
            onToggle={(value) => handleToggle('statuses', value)}
          />
      </div>

       <button 
          onClick={() => onStartCustomSession(filteredQuestions)} 
          disabled={filteredQuestions.length === 0} 
          className="w-full bg-emerald-500 text-white font-bold py-3 px-6 rounded-lg shadow-lg hover:bg-emerald-600 transition-transform hover:scale-105 disabled:bg-bunker-300 dark:disabled:bg-bunker-700 disabled:cursor-not-allowed disabled:scale-100"
        >
          Iniciar Sessão Personalizada ({filteredQuestions.length} Questões)
        </button>

    </div>
  );
};

export default CustomSessionForm;
