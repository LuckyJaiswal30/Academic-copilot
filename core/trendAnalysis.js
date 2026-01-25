function analyzePlanningAccuracyTrend(executionLogs, weeklyPlans) {
    if (executionLogs.length < 2) {
        return { trend: 'insufficient_data', message: 'Insufficient data for trend analysis (need at least 2 weeks).', slope: 0, accuracyScores: [] };
    }
    
    const accuracyScores = [];
    executionLogs.forEach(log => {
        log.entries.forEach(entry => {
            const plan = weeklyPlans.find(p => p.subjectId === entry.subjectId);
            if (plan) {
                const deviation = Math.abs(entry.actualHours - plan.recommendedHours);
                const accuracy = Math.max(0, 1 - (deviation / Math.max(plan.recommendedHours, 1)));
                accuracyScores.push({ weekId: log.weekId, subjectId: entry.subjectId, accuracy: accuracy });
            }
        });
    });
    
    if (accuracyScores.length < 2) {
        return { trend: 'insufficient_data', message: 'Insufficient data points for trend analysis.', slope: 0, accuracyScores: accuracyScores };
    }
    
    const weeks = [...new Set(accuracyScores.map(a => a.weekId))].sort();
    const weekAverages = weeks.map(weekId => {
        const weekScores = accuracyScores.filter(a => a.weekId === weekId);
        return weekScores.length > 0 ? weekScores.reduce((sum, s) => sum + s.accuracy, 0) / weekScores.length : 0;
    });
    
    const n = weekAverages.length;
    const x = weeks.map((_, i) => i);
    const y = weekAverages;
    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = y.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
    const sumXX = x.reduce((sum, val) => sum + val * val, 0);
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    
    let trend = 'stable';
    let message = '';
    if (slope > 0.05) { trend = 'improving'; message = `Planning accuracy is improving over time (slope: ${slope.toFixed(3)}).`; }
    else if (slope < -0.05) { trend = 'deteriorating'; message = `Planning accuracy is deteriorating over time (slope: ${slope.toFixed(3)}).`; }
    else { message = `Planning accuracy is relatively stable (slope: ${slope.toFixed(3)}).`; }
    
    return { trend: trend, message: message, slope: slope, accuracyScores: accuracyScores, weekAverages: weekAverages };
}

function analyzePriorityVolatility(historicalPriorities) {
    if (historicalPriorities.length < 2) {
        return { volatility: 'insufficient_data', message: 'Insufficient data for volatility analysis.', coefficientOfVariation: 0 };
    }
    
    const subjectVolatilities = {};
    historicalPriorities.forEach(prioritySet => {
        prioritySet.results.forEach(result => {
            if (!subjectVolatilities[result.subjectId]) subjectVolatilities[result.subjectId] = [];
            subjectVolatilities[result.subjectId].push(result.priorityScore);
        });
    });
    
    const volatilities = Object.entries(subjectVolatilities).map(([subjectId, scores]) => {
        const mean = scores.reduce((sum, s) => sum + s, 0) / scores.length;
        const variance = scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / scores.length;
        const cv = mean > 0 ? Math.sqrt(variance) / mean : 0;
        return { subjectId: subjectId, coefficientOfVariation: cv, volatility: cv > 0.2 ? 'high' : cv > 0.1 ? 'medium' : 'low' };
    });
    
    const avgVolatility = volatilities.reduce((sum, v) => sum + v.coefficientOfVariation, 0) / volatilities.length;
    
    let message = '';
    if (avgVolatility > 0.2) message = `High priority volatility detected (avg CV: ${avgVolatility.toFixed(2)}).`;
    else if (avgVolatility > 0.1) message = `Moderate priority volatility (avg CV: ${avgVolatility.toFixed(2)}).`;
    else message = `Low priority volatility (avg CV: ${avgVolatility.toFixed(2)}).`;
    
    return { volatility: avgVolatility > 0.2 ? 'high' : avgVolatility > 0.1 ? 'medium' : 'low', message: message, coefficientOfVariation: avgVolatility, subjectVolatilities: volatilities };
}

function analyzeBurnoutIndicators(executionLogs, weeklyPlans) {
    if (executionLogs.length < 3) {
        return { burnoutRisk: 'insufficient_data', message: 'Insufficient data for burnout analysis (need at least 3 weeks).', slope: 0 };
    }
    
    const weeks = [...new Set(executionLogs.map(log => log.weekId))].sort();
    const weeklyMetrics = weeks.map(weekId => {
        const log = executionLogs.find(l => l.weekId === weekId);
        const totalPlanned = weeklyPlans.reduce((sum, p) => sum + p.recommendedHours, 0);
        const totalActual = log ? log.entries.reduce((sum, e) => sum + e.actualHours, 0) : 0;
        return { weekId: weekId, planned: totalPlanned, actual: totalActual, executionRate: totalPlanned > 0 ? totalActual / totalPlanned : 0 };
    });
    
    const n = weeklyMetrics.length;
    const x = weeklyMetrics.map((_, i) => i);
    const plannedY = weeklyMetrics.map(m => m.planned);
    const executionY = weeklyMetrics.map(m => m.executionRate);
    
    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumPlannedY = plannedY.reduce((sum, val) => sum + val, 0);
    const sumExecutionY = executionY.reduce((sum, val) => sum + val, 0);
    const sumXYPlanned = x.reduce((sum, val, i) => sum + val * plannedY[i], 0);
    const sumXYExecution = x.reduce((sum, val, i) => sum + val * executionY[i], 0);
    const sumXX = x.reduce((sum, val) => sum + val * val, 0);
    
    const workloadSlope = (n * sumXYPlanned - sumX * sumPlannedY) / (n * sumXX - sumX * sumX);
    const executionSlope = (n * sumXYExecution - sumX * sumExecutionY) / (n * sumXX - sumX * sumX);
    
    const burnoutRisk = workloadSlope > 0 && executionSlope < -0.05;
    
    let message = '';
    if (burnoutRisk) message = `⚠️ Burnout risk detected: Workload increasing while execution decreasing.`;
    else if (workloadSlope > 0 && executionSlope > 0) message = `Workload and execution both increasing. Monitor capacity.`;
    else if (workloadSlope < 0 && executionSlope > 0) message = `Good capacity management.`;
    else message = `Workload and execution trends are stable or mixed.`;
    
    return { burnoutRisk: burnoutRisk ? 'high' : 'low', message: message, workloadSlope: workloadSlope, executionSlope: executionSlope, weeklyMetrics: weeklyMetrics };
}

function analyzeRiskTrends(historicalRiskAssessments) {
    if (historicalRiskAssessments.length < 2) {
        return { trends: [], message: 'Insufficient data for risk trend analysis.' };
    }
    
    const subjectRisks = {};
    historicalRiskAssessments.forEach(assessment => {
        assessment.risks.forEach(risk => {
            if (!subjectRisks[risk.subjectId]) subjectRisks[risk.subjectId] = [];
            subjectRisks[risk.subjectId].push({ weekId: assessment.weekId, riskScore: risk.riskScore, riskLevel: risk.riskLevel });
        });
    });
    
    const trends = Object.entries(subjectRisks).map(([subjectId, risks]) => {
        if (risks.length < 2) return { subjectId: subjectId, trend: 'insufficient_data', message: 'Insufficient data points.' };
        
        const scores = risks.map(r => r.riskScore);
        const n = scores.length;
        const x = risks.map((_, i) => i);
        const y = scores;
        const sumX = x.reduce((sum, val) => sum + val, 0);
        const sumY = y.reduce((sum, val) => sum + val, 0);
        const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
        const sumXX = x.reduce((sum, val) => sum + val * val, 0);
        const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        
        const trend = slope > 0.05 ? 'increasing' : slope < -0.05 ? 'decreasing' : 'stable';
        return { subjectId: subjectId, trend: trend, slope: slope, message: `Risk is ${trend} (slope: ${slope.toFixed(3)}).` };
    });
    
    return { trends: trends, message: `Analyzed risk trends for ${trends.length} subject(s).` };
}
