
import * as srs from './srsService';

/**
 * ID DETERMINÍSTICO (À Prova de Quebra)
 * Formato: LIT_REF::TYPE::IDX
 */
export function makeDeterministicId(litRef: string, type: string, idx: number | string): string {
    const canon = srs.canonicalizeLitRef(litRef);
    const idxStr = String(idx).padStart(2, '0');
    return `${canon}::${type.toUpperCase()}::${idxStr}`;
}

/**
 * ID ESTÁVEL (Alias para Determinístico)
 * Utilizado para garantir que re-importações não dupliquem registros.
 */
export function makeStableId(litRef: string, type: string, idx: number | string): string {
    return makeDeterministicId(litRef, type, idx);
}

export function makeProgressPk(userId: string, itemId: string): string {
    return `${userId}:${itemId}`;
}
