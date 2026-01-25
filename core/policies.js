const DECISION_POLICIES = {
    BALANCED: {
        id: 'balanced',
        name: 'Balanced Policy',
        description: 'Balances all factors equally, suitable for general academic planning.',
        weights: { interest: 0.4, credits: 0.3, difficulty: 0.3, execution: 0.0 },
        rationale: 'This policy assumes equal importance across interest, credit weight, and difficulty. It is the default policy for users who want a neutral, balanced approach to prioritization.'
    },
    EXAM_FOCUSED: {
        id: 'exam_focused',
        name: 'Exam-Focused Policy',
        description: 'Prioritizes high-credit subjects and difficulty, suitable for exam preparation.',
        weights: { interest: 0.2, credits: 0.5, difficulty: 0.3, execution: 0.0 },
        rationale: 'This policy emphasizes credit weight and difficulty because exams often carry significant weight in final grades. Lower interest weight reflects that exam preparation may not always align with personal interest but is academically necessary.'
    },
    RISK_AVERSE: {
        id: 'risk_averse',
        name: 'Risk-Averse Policy',
        description: 'Prioritizes manageable difficulty and high interest, minimizing risk of failure.',
        weights: { interest: 0.5, credits: 0.2, difficulty: 0.3, execution: 0.0 },
        rationale: 'This policy favors subjects with lower difficulty and higher interest to reduce the risk of poor performance. It is suitable for students who want to build confidence or are managing multiple challenging commitments.'
    },
    EXECUTION_AWARE: {
        id: 'execution_aware',
        name: 'Execution-Aware Policy',
        description: 'Incorporates historical execution patterns to adapt recommendations.',
        weights: { interest: 0.3, credits: 0.3, difficulty: 0.2, execution: 0.2 },
        rationale: 'This policy learns from past behavior by incorporating historical execution rates. Subjects where you consistently meet or exceed recommendations get higher priority, reflecting realistic capacity assessment.'
    }
};

function getPolicy(policyId) {
    return Object.values(DECISION_POLICIES).find(p => p.id === policyId) || DECISION_POLICIES.BALANCED;
}

function getAllPolicies() {
    return Object.values(DECISION_POLICIES);
}

function calculatePriorityWithPolicy(subject, policy, executionData) {
    const normalizedCredits = (subject.creditWeight / 10) * 5;
    const normalizedDifficulty = 6 - subject.difficulty;
    
    let executionComponent = 0;
    let executionExplanation = '';
    if (policy.weights.execution > 0 && executionData) {
        const executionRate = Math.min(executionData.avgActualHours / executionData.recommendedHours, 1.0);
        executionComponent = executionRate * 5;
        executionExplanation = `Historical execution rate: ${(executionRate * 100).toFixed(0)}%`;
    }
    
    const interestComponent = subject.interest * policy.weights.interest;
    const creditsComponent = normalizedCredits * policy.weights.credits;
    const difficultyComponent = normalizedDifficulty * policy.weights.difficulty;
    const executionWeighted = executionComponent * policy.weights.execution;
    
    const priorityScore = interestComponent + creditsComponent + difficultyComponent + executionWeighted;
    
    const explanation = buildPolicyExplanation(subject, policy, priorityScore, {
        interest: interestComponent,
        credits: creditsComponent,
        difficulty: difficultyComponent,
        execution: executionWeighted
    }, executionExplanation);
    
    return {
        priorityScore: priorityScore,
        components: { interest: interestComponent, credits: creditsComponent, difficulty: difficultyComponent, execution: executionWeighted },
        explanation: explanation
    };
}

function buildPolicyExplanation(subject, policy, priorityScore, components, executionExplanation) {
    const parts = [`Under ${policy.name}:`];
    const details = [];
    
    if (components.interest > 0) details.push(`interest (${subject.interest}/5) contributed ${components.interest.toFixed(2)}`);
    if (components.credits > 0) details.push(`credit weight (${subject.creditWeight}) contributed ${components.credits.toFixed(2)}`);
    if (components.difficulty > 0) details.push(`difficulty factor (${6 - subject.difficulty}) contributed ${components.difficulty.toFixed(2)}`);
    if (components.execution > 0 && executionExplanation) details.push(`execution history contributed ${components.execution.toFixed(2)} (${executionExplanation})`);
    
    parts.push(`Score components: ${details.join(', ')}.`);
    
    if (priorityScore >= 3.5) {
        parts.push(`High priority (score: ${priorityScore.toFixed(2)}) due to strong alignment with ${policy.name.toLowerCase()} criteria.`);
    } else if (priorityScore >= 2.5) {
        parts.push(`Medium priority (score: ${priorityScore.toFixed(2)}) with moderate alignment to ${policy.name.toLowerCase()} criteria.`);
    } else {
        parts.push(`Lower priority (score: ${priorityScore.toFixed(2)}) as it does not strongly align with ${policy.name.toLowerCase()} criteria.`);
    }
    
    return parts.join(' ');
}
