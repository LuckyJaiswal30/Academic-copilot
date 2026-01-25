const RISK_FACTORS = {
    DIFFICULTY: { weight: 0.3 },
    LOW_INTEREST: { weight: 0.25 },
    EXECUTION_HISTORY: { weight: 0.25 },
    DEVIATION: { weight: 0.2 }
};

function calculateRiskScore(subject, executionHistory, planDeviation) {
    const riskComponents = {};
    let totalRiskScore = 0;
    
    const difficultyRisk = (subject.difficulty - 1) / 4;
    riskComponents.difficulty = difficultyRisk * RISK_FACTORS.DIFFICULTY.weight;
    totalRiskScore += riskComponents.difficulty;
    
    const interestRisk = (6 - subject.interest) / 4;
    riskComponents.interest = interestRisk * RISK_FACTORS.LOW_INTEREST.weight;
    totalRiskScore += riskComponents.interest;
    
    let executionRisk = 0;
    if (executionHistory) {
        const executionRate = executionHistory.avgActualHours / executionHistory.recommendedHours;
        if (executionRate < 0.7) {
            executionRisk = 1.0 - executionRate;
        } else if (executionRate <= 1.0) {
            executionRisk = (1.0 - executionRate) * 0.5;
        }
    }
    riskComponents.execution = executionRisk * RISK_FACTORS.EXECUTION_HISTORY.weight;
    totalRiskScore += riskComponents.execution;
    
    let deviationRisk = 0;
    if (planDeviation) {
        const deviationPercent = Math.abs(planDeviation.deviationPercent);
        if (deviationPercent > 30) {
            deviationRisk = 1.0;
        } else if (deviationPercent > 10) {
            deviationRisk = deviationPercent / 30;
        }
    }
    riskComponents.deviation = deviationRisk * RISK_FACTORS.DEVIATION.weight;
    totalRiskScore += riskComponents.deviation;
    
    const normalizedRiskScore = Math.min(totalRiskScore, 1.0);
    const riskLevel = normalizedRiskScore <= 0.33 ? 'low' : normalizedRiskScore <= 0.66 ? 'medium' : 'high';
    const explanation = buildRiskExplanation(subject, normalizedRiskScore, riskLevel, riskComponents, executionHistory, planDeviation);
    
    return { riskScore: normalizedRiskScore, riskLevel: riskLevel, components: riskComponents, explanation: explanation };
}

function buildRiskExplanation(subject, riskScore, riskLevel, components, executionHistory, planDeviation) {
    const factors = [];
    
    if (components.difficulty > 0.1) factors.push(`high difficulty (${subject.difficulty}/5)`);
    if (components.interest > 0.1) factors.push(`low interest level (${subject.interest}/5)`);
    if (components.execution > 0.1 && executionHistory) {
        const executionRate = (executionHistory.avgActualHours / executionHistory.recommendedHours * 100).toFixed(0);
        factors.push(`poor execution history (${executionRate}% of recommended)`);
    }
    if (components.deviation > 0.1 && planDeviation) {
        factors.push(`high planning deviation (${Math.abs(planDeviation.deviationPercent).toFixed(0)}%)`);
    }
    
    let explanation = `Risk Level: ${riskLevel.toUpperCase()} (score: ${riskScore.toFixed(2)}). `;
    explanation += factors.length > 0 ? `Risk factors: ${factors.join(', ')}. ` : `No significant risk factors identified. `;
    
    if (riskLevel === 'high') {
        explanation += `This subject requires careful planning and may need additional support or buffer time.`;
    } else if (riskLevel === 'medium') {
        explanation += `Monitor progress closely and adjust plans if needed.`;
    } else {
        explanation += `This subject appears manageable with standard planning.`;
    }
    
    return explanation;
}

function rankByRisk(riskAssessments) {
    return [...riskAssessments].sort((a, b) => b.riskScore - a.riskScore);
}
