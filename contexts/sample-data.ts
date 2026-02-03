
import { Question } from '../types';
import * as srs from '../services/srsService';

const sampleDataText = `DATE;BANK;POSITION;SUBJECT;TOPIC;QUESTION_REF;QUESTION_TEXT;ALT_A;ALT_B;ALT_C;ALT_D;ALT_E;EXPLANATION;YOUR_ANSWER;CORRECT_ANSWER;ISCORRECT;TIME_SEC;LEVEL;HOT_TOPIC
2025-10-25;FCC;Analista TI Ágil;Scrum / Agile;Natureza do Scrum (framework leve);Q1 - Natureza do Scrum;O Scrum é descrito no Guia Scrum como um método completo e prescritivo para o desenvolvimento de software, detalhando todas as técnicas e processos que uma equipe deve obrigatoriamente seguir para garantir o sucesso do projeto.;Correto, pois sua natureza prescritiva elimina a necessidade de a equipe tomar decisions sobre o processo.;Incorreto, pois Scrum é um framework leve e intencionalmente incompleto, que define uma estrutura base para que as equipes possam empregar suas próprias práticas.;Correto, pois a rigidez do método Scrum é o que garante a agilidade, ao padronizar o trabalho de todas as equipes da organização.;Incorreto, pois Scrum é uma metodologia aplicável apenas a projetos de hardware, não de software.;Correto, pois o Guia Scrum contém todos os templates e diagramas necessários para a documentação formal do projeto.;Scrum é um framework leve e incompleto, não um método totalmente prescritivo. A alternativa correta é B.;B;B;0;60;3;0
2025-10-25;FCC;Analista TI Ágil;Scrum / Agile;Transparência, Inspeção, Adaptação;Q2 - Pilares na Daily;Uma equipe de desenvolvimento percebe, durante uma Daily Scrum, que o progresso reportado em uma tarefa crucial não corresponde à realidade técnica, pois um impedimento grave não foi comunicado. A decision da equipe de imediatamente expor o problema e replanejar o dia demonstra a aplicação direta de quais pilares do Scrum?;Foco e Respeito.;Transparência, Inspeção e Adaptação.;Empirismo e Comprometimento.;Coragem e Abertura.;Inspeção e Abertura, mas não Adaptação.;A cena mostra transparência ao expor o problema, inspeção na Daily e adaptação ao replanejar. Correta B.;B;B;0;60;3;0
2025-10-25;FCC;Analista TI Ágil;Scrum / Agile;Responsabilidades do Product Owner;Q3 - Papel do PO;Em um projeto Scrum, a principal responsabilidade por garantir que o trabalho da equipe de desenvolvimento esteja alinhado com as necessidades do negócio, priorizando os itens que geram maior retorno sobre o investimento, recai sobre o:;Scrum Master, que deve facilitar a comunicação entre a equipe e os stakeholders.;Cliente, que participa delle riunioni giornaliere per validare il trabalho.;Gerente de Projetos, que controla o cronograma e o orçamento.;Product Owner, que é o único responsável por gerenciar o Product Backlog.;Time de Desenvolvimento, que se auto-organiza para definir as prioridades do negócio.;Maximizar valor e priorizar o backlog é responsabilidade do Product Owner. Correta D.;D;D;0;60;3;0
2025-10-25;FCC;Analista TI Ágil;Scrum / Agile;Sprint: cancelamento e regras;Q4 - Sprint e cancelamento;Assinale a afirmativa INCORRETA sobre o evento Sprint no Scrum.;É um evento com duração fixa de um mês ou menos.;Durante a Sprint, a composição do Time de Desenvolvimento e o Sprint Goal devem permanecer estáveis.;A Sprint pode ser cancelada pelo Scrum Master se ele julgar que o objetivo se tornou obsoleto.;Uma nova Sprint começa imediatamente após a conclusão da Sprint anterior.;Contém e consiste na Sprint Planning, Daily Scrums, o trabalho de desenvolvimento, Sprint Review e Sprint Retrospective.;Somente o Product Owner pode cancelar a Sprint. Dizer que o Scrum Master cancela está errado, então a incorreta é C.;C;C;0;60;3;1
2025-10-25;FCC;Analista TI Ágil;Scrum / Agile;Daily Scrum propósito;Q5 - Daily Scrum propósito;O propósito primário da Daily Scrum é:;Apresentar um relatório de progresso detalhado ao Product Owner e aos stakeholders.;Resolver problemas técnicos complexos em uma sessão de trabalho colaborativa.;Inspecionar o progresso em direção ao Sprint Goal e adaptar o plano para as próximas 24 horas.;Atualizar o Sprint Backlog com novas tarefas identificadas pelo Scrum Master.;Avaliar a performance individual de cada membro do Time de Desenvolvimento.;A Daily Scrum serve para inspecionar o progresso rumo ao Sprint Goal e ajustar o plano do próximo dia, não para avaliar desempenho individual. Correta C.;E;C;1;60;0;1
2025-10-25;FCC;Analista TI Ágil;Scrum / Agile;Artefatos - Product Backlog;Q6 - Artefato chave;Qual artefato do Scrum é uma lista ordenada de tudo o que é conhecido ser necessário no produto e é a única fonte de requisitos para quaisquer mudanças a serem feitas?;Sprint Goal.;Incremento do Produto.;Sprint Backlog.;Definição de Pronto.;Product Backlog.;O Product Backlog é a lista ordenada e a única fonte oficial de requisitos. Correta E.;E;E;0;60;3;0
2025-10-25;FCC;Analista TI Ágil;Scrum / Agile;Valores do Scrum, Coragem;Q7 - Valor demonstrado;Um desenvolvedor júnior, durante a Sprint Retrospective, aponta uma falha no processo que foi causada por um erro de um colega sênior. A equipe discute o problema de forma construtiva, sem culpas, focando em como evitar que o erro se repita. A atitude do desenvolvedor júnior exemplifica principalmente o valor de:;Foco.;Comprometimento.;Coragem.;Simplicidade.;Respeito.;Falar uma verdade difícil para melhorar o processo exige coragem. Correta C.;E;C;1;60;0;1
2025-10-25;FCC;Analista TI Ágil;Scrum / Agile;Sprint Review vs Retrospective;Q8 - Review vs Retro;A distinção fundamental entre a Sprint Review e a Sprint Retrospective é que a primeira foca em inspecionar o produto entregue, enquanto a segunda foca em inspecionar o processo da equipe.;processo / produto;Scrum Master / Product Owner;incremento do produto / processo da equipe;backlog / cronograma;time / impedimentos;Sprint Review olha o incremento do produto e coleta feedback. Retrospective olha como a equipe trabalhou e como vai melhorar o processo. Correta C.;D;C;1;60;0;1
2025-10-25;FCC;Analista TI Ágil;Scrum / Agile;Scrum Master, proteção da equipe;Q9 - Proteção do time;Considere a seguinte situação, a equipe de desenvolvimento está sendo constantemente interrompida por um gerente de outro departamento que solicita pequenas alterações e relatórios urgentes, desviando o foco do Sprint Goal. A ação correta, segundo o Scrum, seria:;O Product Owner negociar com o gerente para incluir as solicitações no Product Backlog.;A equipe de desenvolvimento atender às solicitações, pois a colaboração entre departamentos é um valor ágil.;O Scrum Master intervir, proteger a equipe das interrupções e orientar o gerente sobre como interagir com o Time Scrum.;Cada desenvolvedor individualmente decidir se a solicitação do gerente é mais importante que o trabalho da Sprint.;A equipe realizar uma nova Sprint Planning para incluir as novas demandas do gerente.;O Scrum Master atua como escudo do time contra interferência externa e educa o ambiente. Correta C.;C;C;0;60;3;0
2025-10-25;FCC;Analista TI Ágil;Scrum / Agile;Propriedade do Sprint Backlog;Q10 - Dono do Sprint Backlog;Durante uma Sprint, quem pode adicionar, remover ou modificar os itens do Sprint Backlog?;Apenas o Product Owner.;Apenas o Scrum Master.;Os stakeholders, através do Product Owner.;O Time de Desenvolvimento.;Ninguém, pois o Sprint Backlog é imutável após a Sprint Planning.;O Sprint Backlog é um plano feito pelo e para os Developers, logo só eles mudam. Correta D.;A;D;1;60;0;1
2025-10-25;FCC;Analista TI Ágil;Scrum / Agile;Time-box, duração máxima;Q11 - Time-box;O conceito de time-box no Scrum significa que os eventos:;Têm uma duração exata que não pode ser nem maior nem menor.;Têm uma duração máxima que não deve ser excedida, mas podem terminar mais cedo se o objetivo for alcançado.;São agendados em um calendário fixo no início do projeto e não podem ser reagendados.;Têm sua duração definida pelo Product Owner de acordo com as necessidades do negócio.;Podem ser estendidos pelo Time de Desenvolvimento caso necessitem de mais tempo para concluir o trabalho.;Time-box é limite máximo de tempo, o evento pode acabar antes se cumprir o propósito. Correta B.;;B;1;60;0;1
2025-10-25;FCC;Analista TI Ágil;Scrum / Agile;Pilares vs Valores;Q12 - Pilar vs Valor;Transparência e Foco são, respectivamente:;Um pilar e um valor do Scrum.;Um valor e um pilar do Scrum.;Dois pilares do Scrum.;Dois valores do Scrum.;Um princípio e uma prática do Scrum.;Transparência é pilar do empirismo e Foco é um dos valores. Correta A.;A;A;0;60;3;0
2025-10-25;FCC;Analista TI Ágil;Scrum / Agile;Time Scrum, hierarquia;Q13 - Time Scrum;Sobre o Time Scrum, não é correto afirmar que:;É auto-organizável e multifuncional.;É composto pelo Product Owner, Scrum Master e Time de Desenvolvimento.;Possui sub-equipes ou hierarquias formais para otimizar o trabalho.;É responsável por todas as atividades relacionadas ao produto.;Tem, idealmente, segundo o Guia Scrum 2017, entre 3 e 9 desenvolvedores.;O Time Scrum é plano e sem sub grupos hierárquicos. Dizer que possui sub equipes ou hierarquias formais está errado. Correta C.;C;C;0;60;3;0
2025-10-25;FCC;Analista TI Ágil;Scrum / Agile;Comparação Scrum vs Waterfall;Q14 - Scrum vs Waterfall;Scrum se assemelha a uma abordagem tradicional em cascata porque:;Ambos priorizam a entrega de todo o escopo do projeto de uma só vez no final.;Ambos seguem uma sequência linear e inflexível de fases.;Ambos valorizam a documentação abrangente acima do software em funcionamento.;Ambos definem papéis claros para a equipe, como o de gerente de projeto.;Nenhuma das alternativas anteriores está correta, pois seus princípios são fundamentalmente opostos.;Scrum e waterfall seguem princípios opostos, então nenhuma das alternativas é válida. Correta E.;E;E;0;60;3;0
2025-10-25;FCC;Analista TI Ágil;Scrum / Agile;Cancelamento da Sprint;Q15 - Quem cancela a Sprint;Uma Sprint pode ser cancelada se seu objetivo se tornar obsoleto. Quem tem a autoridade para tomar essa decisão?;O Scrum Master.;O Time de Desenvolvimento.;O Product Owner.;Os stakeholders por votação.;O cliente em acordo com o Scrum Master.;Somente o Product Owner tem autoridade para cancelar a Sprint.;E;C;1;60;0;1
2025-10-25;FCC;Analista TI Ágil;Scrum / Agile;Scrum Master papel na Retrospective;MQ1 - Scrum Master na Retro;Durante a Sprint Retrospective, a equipe identifica que o processo de deploy está muito lento. O Scrum Master, por sua autoridade, deve:;Adicionar um item ao próximo Sprint Backlog para automatizar o deploy.;Exigir que o Product Owner priorize a automação do deploy no Product Backlog.;Atuar como um coach, ajudando a equipe a entender a importância do problema e a decidir como resolvê-lo, talvez adicionando um item de melhoria ao Sprint Backlog.;Cancelar a próxima Sprint para que a equipe possa focar exclusivamente em resolver o problema de deploy.;Alterar a Definição de Pronto para incluir o deploy automatizado.;O Scrum Master atua como facilitador e coach, ajudando o time a melhorar o processo sem impor solução. Correta C.;C;C;0;105;2;1
2025-10-25;FCC;Analista TI Ágil;Scrum / Agile;PO vs Developers, Sprint Backlog;MQ2 - PO quer mudança urgente;Durante uma Sprint, o Product Owner percebe uma oportunidade de mercado e identifica uma pequena funcionalidade que precisa ser adicionada imediatamente. A ação correta do Product Owner é:;Adicionar a tarefa diretamente no Sprint Backlog da equipe.;Interromper a Daily Scrum para comunicar a nova prioridade à equipe.;Adicionar o item ao Product Backlog, priorizá-lo e negociar com os Developers a possibilidade de incluí-lo na Sprint atual, ciente de que eles podem recusar se o Sprint Goal for afetado.;Enviar um e-mail para o Scrum Master solicitando que ele adicione a tarefa ao plano dos Developers.;Esperar a Sprint Review para anunciar a nova funcionalidade.;O PO prioriza no Product Backlog e negocia com os Developers, pois o Sprint Backlog pertence aos Developers. Correta C.;C;C;0;105;2;1
`;

export const SAMPLE_QUESTIONS: Omit<Question, 'id'>[] = sampleDataText
  .split('\n')
  .slice(1) // Skip header row
  .reduce<Omit<Question, 'id'>[]>((questions, line, index) => {
    if (!line || line.trim() === '') {
      return questions;
    }

    const parts = line.split(';');
    if (parts.length < 19) {
      console.warn(`[Sample Data] Line ${index + 2} is malformed (expected 19+ columns, found ${parts.length}) and will be skipped. Content: "${line}"`);
      return questions;
    }

    const [
      dateStr, bank, position, subject, topic, qRef, qText,
      aA, aB, aC, aD, aE, expl, yAns, cAns,
      isCorr, time, lvl, hot
    ] = parts.map(p => (p || '').trim());
    
    const selfEvalLevel = parseInt(lvl, 10);
    const timeSec = parseInt(time, 10);

    if (isNaN(selfEvalLevel) || isNaN(timeSec)) {
      console.warn(`[Sample Data] Line ${index + 2} has invalid number value for time or level and will be skipped. Content: "${line}"`);
      return questions;
    }

    const lastWasCorrect = isCorr === '0';
    const srsStage = Math.floor(Math.random() * 3);
    const today = srs.todayISO();
    const lastAttemptDate = dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? dateStr : today;
    const nextReviewDate = srs.addDaysISO(today, (Math.random() * 14 - 7)); 

    const finalMastery = 0;

    const newQuestion: Omit<Question, 'id'> = {
      sequenceNumber: index + 1,
      bank,
      position,
      subject,
      topic,
      area: subject,
      questionRef: qRef,
      questionText: qText,
      options: { A: aA, B: aB, C: aC, D: aD, E: aE },
      explanation: expl,
      comments: '',
      yourAnswer: yAns,
      correctAnswer: cAns,
      lastAttemptDate: lastAttemptDate,
      createdAt: lastAttemptDate,
      totalAttempts: 1,
      lastWasCorrect: lastWasCorrect,
      timeSec: timeSec,
      selfEvalLevel: selfEvalLevel,
      masteryScore: finalMastery,
      nextReviewDate: nextReviewDate,
      hotTopic: hot === '1',
      isFavorite: false,
      willFallExam: false,
      srsStage: srsStage,
      correctStreak: lastWasCorrect ? 1 : 0,
      isCritical: Math.random() < 0.1,
      isFundamental: false,
      recentError: lastWasCorrect ? 0 : 1,
      difficultyLevel: 'normal',
      difficulty: 0.5, // Explicit numeric assignment
      srsVersion: 2,
      stability: 1,
      errorCount: lastWasCorrect ? 0 : 1, 
      lawRef: '', 
      questionType: '01 Literalidade', // Fixed: Added default questionType
      attemptHistory: [{
          date: lastAttemptDate,
          wasCorrect: lastWasCorrect,
          masteryAfter: finalMastery,
          stabilityAfter: 1,
          timeSec: timeSec,
          selfEvalLevel: selfEvalLevel,
      }]
    };
    
    questions.push(newQuestion);
    return questions;
  }, []);
