
# Miaaula Audit Architecture

## Visão Geral
O sistema de auditoria do Miaaula é um mecanismo de defesa passiva (Read-Only) projetado para garantir a integridade dos dados locais (IndexedDB/LocalStorage) e detectar regressões de lógica (Drift) sem intervenção automática destrutiva.

## Pilares
1.  **Golden Baseline**: Definição estática de como os dados *devem* parecer (Schema e Invariantes).
2.  **Blackbox Logger**: Gravação sequencial de eventos críticos (Import, Save, Load) em um Ring Buffer persistente.
3.  **Drift Detector**: Comparador em tempo de execução que alerta se os dados vivos desviarem do contrato (ex: perda de IDs canônicos).

## Fluxo de Dados Crítico
1.  **Import**: Parser -> Normalization -> ID Generation (Canonical) -> Store.
2.  **Linkage**: Card.id (LawRef) <-> Question.lawRef.
3.  **Persistence**: React State -> JSON Stringify -> IndexedDB.

## Invariantes do Sistema
1.  **Unique IDs**: Todo ID deve ser único globalmente por tipo de entidade.
2.  **No Temp IDs**: IDs `temp_` ou `new_` não devem persistir após o refresh da página.
3.  **Canonical References**: `question.lawRef` deve corresponder a um `card.id` existente (exceto questões órfãs intencionais).
4.  **Imutabilidade de Histórico**: `attemptHistory` deve ser apenas append-only.

## Runbook de Rollback
Caso o `Audit Report` mostre "COLLAPSE_DETECTED":
1.  Não salvar novos dados.
2.  Exportar "Audit Package" via Settings.
3.  Usar ferramenta de "Restaurar Backup" com um JSON anterior validado.
4.  Se o problema for no código (Schema Drift), reverter para commit marcado como `stable-v16`.
