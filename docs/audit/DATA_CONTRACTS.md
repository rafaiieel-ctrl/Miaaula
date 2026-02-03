
# Data Contracts & Schemas

## 1. LiteralnessCard (Artigo)
```typescript
interface LiteralnessCard {
  id: string; // CANONICAL: UpperCase, NoSpaces (ex: "GO_CDC_ART42")
  lawId: string; // Grouping Key
  questionIds: string[]; // CACHE ONLY - Source of Truth is Question.lawRef
  nextReviewDate: ISOString;
  ...
}
```

## 2. Question (Questão)
```typescript
interface Question {
  id: string; // DETERMINISTIC: `${lawRef}__${qRef}` or Hash
  questionRef: string; // Human Readable (ex: "Q01")
  lawRef: string; // FOREIGN KEY -> LiteralnessCard.id
  options: { A: string, B: string, ... }; // Must have content
  ...
}
```

## 3. Flashcard
```typescript
interface Flashcard {
  id: string; // Unique
  tags: string[]; // Contains LitRef for linkage
  ...
}
```

## Regras de Importação
1.  **LawRef Normalization**: Todo `LAW_REF` ou `LIT_REF` importado passa por `canonicalizeLitRef()` (Trim + Upper + Underscore).
2.  **ID Stability**: Se o ID não for fornecido, ele é gerado deterministicamente baseado em `LawRef + QRef + TextHash` para evitar duplicatas em re-imports.
