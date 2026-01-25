const CONFIDENCE_LEVELS = { HIGH: 'high', MEDIUM: 'medium', LOW: 'low' };

function calculateConfidence(subject, executionHistory, historicalPriorities) {
    let confidenceScore = 0;
    const factors = [];
    
    let dataAvailabilityScore = 0;
    if (executionHistory && executionHistory.dataPoints >= 3) {
        dataAvailabilityScore = 0.4;
        factors.push('sufficient historical data');
    } else if (executionHistory && executionHistory.dataPoints >= 1) {
        dataAvailabilityScore = 0.2;
        factors.push('limited historical data');
    } else {
        factors.push('no historical data');
    }
    confidenceScore += dataAvailabilityScore;
    
    let executionStabilityScore = 0;
    if (executionHistory && executionHistory.dataPoints >= 2) {
        const deviations = executionHistory.deviations || [];
        if (deviations.length > 0) {
            const mean = deviations.reduce((sum, d) => sum + Math.abs(d), 0) / deviations.length;
            const variance = deviations.reduce((sum, d) => sum + Math.pow(Math.abs(d) - mean, 2), 0) / deviations.length;
            const cv = mean > 0 ? Math.sqrt(variance) / mean : 0;
            
            if (cv < 0.2) { executionStabilityScore = 0.3; factors.push('stable execution patterns'); }
            else if (cv < 0.5) { executionStabilityScore = 0.15; factors.push('moderate execution variability'); }
            else { factors.push('high execution variability'); }
        }
    }
    confidenceScore += executionStabilityScore;
    
    let inputConsistencyScore = 0;
    if (historicalPriorities && historicalPriorities.length >= 2) {
        const priorityScores = historicalPriorities.map(p => p.priorityScore);
        const mean = priorityScores.reduce((sum, p) => sum + p, 0) / priorityScores.length;
        const variance = priorityScores.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / priorityScores.length;
        const cv = mean > 0 ? Math.sqrt(variance) / mean : 0;
        
        if (cv < 0.1) { inputConsistencyScore = 0.3; factors.push('stable input parameters'); }
        else if (cv < 0.2) { inputConsistencyScore = 0.15; factors.push('moderate input variability'); }
        else { factors.push('high input variability'); }
    } else {
        inputConsistencyScore = 0.15;
        factors.push('initial assessment');
    }
    confidenceScore += inputConsistencyScore;
    
    const confidenceLevel = confidenceScore >= 0.7 ? CONFIDENCE_LEVELS.HIGH : confidenceScore >= 0.4 ? CONFIDENCE_LEVELS.MEDIUM : CONFIDENCE_LEVELS.LOW;
    
    let explanation = `Confidence: ${confidenceLevel.toUpperCase()} (score: ${confidenceScore.toFixed(2)}). Based on: ${factors.join(', ')}. `;
    if (confidenceLevel === CONFIDENCE_LEVELS.LOW) {
        explanation += `Recommendations should be treated as preliminary.`;
    } else if (confidenceLevel === CONFIDENCE_LEVELS.MEDIUM) {
        explanation += `Recommendations are reasonably reliable.`;
    } else {
        explanation += `Recommendations are highly reliable.`;
    }
    
    return { confidenceScore: confidenceScore, confidenceLevel: confidenceLevel, factors: factors, explanation: explanation };
}

function getConfidenceDisclaimer(recommendation, confidence) {
    if (confidence.confidenceLevel === CONFIDENCE_LEVELS.LOW) {
        return `⚠️ Low confidence recommendation. Use with caution.`;
    } else if (confidence.confidenceLevel === CONFIDENCE_LEVELS.MEDIUM) {
        return `ℹ️ Medium confidence recommendation. Monitor and adjust as needed.`;
    }
    return '';
}
