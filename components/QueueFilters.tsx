
import React, { useState, useMemo } from 'react';
import { Question, QueueFilters as Filters, Flashcard } from '../types';
import { ChevronDownIcon } from './icons';

interface QueueFiltersProps {
  allItems: (Question | Flashcard)[];
  onFilterChange: (filters: Filters) => void;
}

type StatusFilter = 'recentError' | 'isHot' | 'isCritical' | 'isFundamental' | 'isFavorite' | 'isStudyLater';

const FilterCheckboxList: React.FC<{
    title: string;
    items: { value: string, label: string }[];
    selectedItems: string[];
    onToggle: (value: string) => void;
}> = ({ title, items, selectedItems, onToggle }) => {
    if (items.length === 0) return null;
    return (
        <details className="group border-b border-bunker-200 dark:border-bunker-700 last:border-b-0 py-2">
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
                            checked={selectedItems.includes(item.value)}
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

const QueueFilters: React.FC<QueueFiltersProps> = ({ allItems, onFilterChange }) => {
  const [filters, setFilters] = useState<Filters>({});

  const uniqueValues = useMemo(() => {
    const subjects = new Set<string>();
    const topics = new Set<string>();
    const types = new Set<string>();
    const banks = new Set<string>();
    const positions = new Set<string>();
    const areas = new Set<string>();
    const tags = new Set<string>();

    allItems.forEach(item => {
      // Handle Discipline (Flashcard) vs Subject (Question)
      if ('subject' in item) subjects.add(item.subject);
      else if ('discipline' in item) subjects.add(item.discipline);
      
      if (item.topic) topics.add(item.topic);
      
      if ('questionType' in item && item.questionType) types.add(item.questionType);
      if ('bank' in item && item.bank) banks.add(item.bank);
      if ('position' in item && (item as Question).position) positions.add((item as Question).position);
      if ('area' in item && (item as Question).area) areas.add((item as Question).area);
      if ('tags' in item && Array.isArray(item.tags)) {
        item.tags.forEach(tag => tags.add(tag));
      }
    });

    return {
      subjects: Array.from(subjects).sort(),
      topics: Array.from(topics).sort(),
      types: Array.from(types).sort(),
      banks: Array.from(banks).sort(),
      positions: Array.from(positions).sort(),
      areas: Array.from(areas).sort(),
      tags: Array.from(tags).sort(),
    };
  }, [allItems]);

  const handleToggle = (category: keyof Omit<Filters, 'isHot' | 'isFundamental' | 'isCritical' | 'recentError' | 'isFavorite' | 'isStudyLater'>, value: string) => {
    // Explicitly cast filters[category] to ensure it is treated as string[] or undefined
    const currentList = (filters[category] as string[] | undefined) || [];
    const newSet = new Set(currentList);
    if (newSet.has(value)) {
      newSet.delete(value);
    } else {
      newSet.add(value);
    }
    const newFilters = { ...filters, [category]: Array.from(newSet) };
    if (newSet.size === 0) delete (newFilters as any)[category];
    setFilters(newFilters);
    onFilterChange(newFilters);
  };
  
  const handleFlagToggle = (flag: StatusFilter) => {
    const newFilters = { ...filters, [flag]: !filters[flag] };
    if (!newFilters[flag]) delete (newFilters as any)[flag];
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const statusItems: { value: StatusFilter, label: string }[] = [
    { value: 'isFavorite', label: 'Favoritas ⭐' },
    { value: 'isStudyLater', label: 'Estudar Depois ⏳' },
    { value: 'recentError', label: 'Erradas ❌' },
    { value: 'isHot', label: 'Quentes 🔥' },
    { value: 'isCritical', label: 'Com Atenção ⚠️' },
    { value: 'isFundamental', label: 'Fundamentais 💎' },
  ];

  const clearFilters = () => {
      setFilters({});
      onFilterChange({});
  }

  return (
    <div className="p-4 bg-bunker-100 dark:bg-bunker-900 rounded-lg space-y-2">
      <div className="flex justify-between items-center">
        <h3 className="font-bold">Filtros da Sessão</h3>
        <button onClick={clearFilters} className="text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline">Limpar Filtros</button>
      </div>
      <div className="space-y-1 p-2 border border-bunker-200 dark:border-bunker-800 rounded-lg">
          <details className="group border-b border-bunker-200 dark:border-bunker-700 last:border-b-0 py-2">
            <summary className="flex justify-between items-center cursor-pointer p-2 rounded-lg hover:bg-bunker-100/50 dark:hover:bg-bunker-800/50">
                <span className="font-semibold">Status e Flags</span>
                <div className="transition-transform group-open:rotate-180">
                    <ChevronDownIcon />
                </div>
            </summary>
            <div className="pl-4 pt-2 space-y-2">
                {statusItems.map(item => (
                    <label key={item.value} className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={!!filters[item.value as keyof Filters]}
                            onChange={() => handleFlagToggle(item.value)}
                            className="h-4 w-4 rounded border-gray-300 text-sky-600 focus:ring-sky-500"
                        />
                        <span className="text-sm">{item.label}</span>
                    </label>
                ))}
            </div>
          </details>

          <FilterCheckboxList 
            title="Disciplinas"
            items={uniqueValues.subjects.map(s => ({ value: s, label: s }))}
            selectedItems={filters.subjects || []}
            onToggle={(value) => handleToggle('subjects', value)}
          />
          <FilterCheckboxList 
            title="Áreas"
            items={uniqueValues.areas.map(a => ({ value: a, label: a }))}
            selectedItems={filters.areas || []}
            onToggle={(value) => handleToggle('areas', value)}
          />
          <FilterCheckboxList 
            title="Tópicos"
            items={uniqueValues.topics.map(t => ({ value: t, label: t }))}
            selectedItems={filters.topics || []}
            onToggle={(value) => handleToggle('topics', value)}
          />
           <FilterCheckboxList 
            title="Tags (Flashcards)"
            items={uniqueValues.tags.map(t => ({ value: t, label: t }))}
            selectedItems={filters.tags || []}
            onToggle={(value) => handleToggle('tags', value)}
          />
          <FilterCheckboxList 
            title="Banca"
            items={uniqueValues.banks.map(b => ({ value: b, label: b }))}
            selectedItems={filters.banks || []}
            onToggle={(value) => handleToggle('banks', value)}
          />
          <FilterCheckboxList 
            title="Tipos de Questão"
            items={uniqueValues.types.map(t => ({ value: t, label: t }))}
            selectedItems={filters.questionTypes || []}
            onToggle={(value) => handleToggle('questionTypes', value)}
          />
      </div>
    </div>
  );
};

export default QueueFilters;