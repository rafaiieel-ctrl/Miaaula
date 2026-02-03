
import { Question, Flashcard, LiteralnessCard } from '../types';
import { isFrozen, normalizeKey } from './disciplineFlags';
import { normalizeDiscipline } from './taxonomyService';

type ContentItem = Question | Flashcard | LiteralnessCard;

/**
 * Resolves the discipline name from any content item type.
 * Priority: discipline (Flashcard) > subject (Question) > lawId (Literalness)
 */
export function resolveDisciplineName(item: ContentItem | any): string {
    if (!item) return '';

    let rawName = '';

    if ('discipline' in item && item.discipline) {
        rawName = item.discipline;
    } else if ('subject' in item && item.subject) {
        rawName = item.subject;
    } else if ('lawId' in item && item.lawId) {
        rawName = item.lawId;
    } else if ('area' in item && item.area) {
        rawName = item.area;
    }

    return normalizeDiscipline(rawName);
}

/**
 * TYPE GUARD: Ensures the item is a valid Question and NOT a Gap/Lacuna.
 * Used to sanitize Question Runners from mixed content.
 */
export function isStrictQuestion(item: Question): boolean {
    if (!item) return false;
    
    // 1. Explicit Flag check
    if (item.isGapType) return false;
    
    // 2. Ref Heuristic (Legacy imports might lack flag)
    if (item.questionRef && typeof item.questionRef === 'string') {
        if (item.questionRef.startsWith('GAP-') || item.questionRef.startsWith('LACUNA-')) {
            return false;
        }
    }
    
    // 3. Content Heuristic (Double mustaches indicate gap syntax)
    if (item.questionText && typeof item.questionText === 'string') {
        if (item.questionText.includes('{{') && item.questionText.includes('}}')) {
            return false;
        }
    }

    // 4. Structure Check
    if (!item.correctAnswer && !item.options) return false;

    return true;
}

/**
 * The Global Gatekeeper.
 * Returns TRUE only if:
 * 1. The item exists (is not null/undefined) - Handles Deleted items
 * 2. The item's discipline is NOT frozen - Handles Frozen items
 */
export function canExecuteItem(item: ContentItem | null | undefined): boolean {
    // 1. Integrity Check (Deleted items or invalid refs result in null/undefined)
    if (!item) return false;

    // 2. Frozen Check
    const discipline = resolveDisciplineName(item);
    if (!discipline) return true; // uncategorized items default to executable unless specific rule exists

    // Check against persistent flags
    if (isFrozen(discipline)) {
        return false;
    }

    return true;
}

/**
 * Bulk filter for arrays of content.
 * Efficiently removes frozen or invalid items.
 */
export function filterExecutableItems<T extends ContentItem>(items: T[]): T[] {
    if (!items || !Array.isArray(items)) return [];
    return items.filter(canExecuteItem);
}
