const INSIGHT_MATURITY = { RAW: 'raw', PATTERN: 'pattern', BEHAVIORAL: 'behavioral' };

function generateMatureInsights(executionLogs, weeklyPlans, subjects) {
    const insights = { raw: [], pattern: [], behavioral: [] };
    insights.raw = generateRawInsights(executionLogs, weeklyPlans, subjects);
    if (executionLogs.length >= 2) insights.pattern = generatePatternInsights(executionLogs, weeklyPlans, subjects);
    if (executionLogs.length >= 3) insights.behavioral = generateBehavioralInsights(executionLogs, weeklyPlans, subjects);
    return insights;
}

function generateRawInsights(executionLogs, weeklyPlans, subjects) {
    const insights = [];
    if (executionLogs.length === 0 || weeklyPlans.length === 0) return insights;
    
    weeklyPlans.forEach(plan => {
        const subject = subjects.find(s => s.id === plan.subjectId);
        if (!subject) return;
        const entries = executionLogs.flatMap(log => log.entries.filter(e => e.subjectId === plan.subjectId));
        if (entries.length === 0) return;
        
        const avgActual = entries.reduce((sum, e) => sum + e.actualHours, 0) / entries.length;
        const deviation = avgActual - plan.recommendedHours;
        const deviationPercent = (deviation / plan.recommendedHours) * 100;
        
        if (Math.abs(deviationPercent) > 20) {
            insights.push({
                type: 'deviation',
                subjectName: plan.subjectName,
                maturity: INSIGHT_MATURITY.RAW,
                message: `${plan.subjectName}: Actual hours (${avgActual.toFixed(1)}) ${deviation > 0 ? 'exceed' : 'fall short of'} recommended hours (${plan.recommendedHours.toFixed(1)}) by ${Math.abs(deviationPercent).toFixed(0)}%.`,
                recommendation: deviation > 0 ? 'Consider if recommendations are too conservative.' : 'Review if recommendations are realistic.',
                data: { recommended: plan.recommendedHours, actual: avgActual, deviation: deviation, deviationPercent: deviationPercent }
            });
        }
    });
    return insights;
}

function generatePatternInsights(executionLogs, weeklyPlans, subjects) {
    const insights = [];
    
    weeklyPlans.forEach(plan => {
        const entries = executionLogs.flatMap(log => log.entries.filter(e => e.subjectId === plan.subjectId));
        if (entries.length < 2) return;
        
        const underestimationWeeks = entries.filter(e => e.actualHours < plan.recommendedHours * 0.8).length;
        const underestimationRate = underestimationWeeks / entries.length;
        if (underestimationRate >= 0.6) {
            insights.push({
                type: 'repeated_underestimation', subjectName: plan.subjectName, maturity: INSIGHT_MATURITY.PATTERN,
                message: `${plan.subjectName}: You consistently study less than recommended in ${(underestimationRate * 100).toFixed(0)}% of weeks.`,
                recommendation: 'Consider adjusting expectations or re-evaluating available time.',
                data: { underestimationRate: underestimationRate, weeksAnalyzed: entries.length }
            });
        }
        
        const overcommitmentWeeks = entries.filter(e => e.actualHours > plan.recommendedHours * 1.2).length;
        const overcommitmentRate = overcommitmentWeeks / entries.length;
        if (overcommitmentRate >= 0.6) {
            insights.push({
                type: 'repeated_overcommitment', subjectName: plan.subjectName, maturity: INSIGHT_MATURITY.PATTERN,
                message: `${plan.subjectName}: You consistently study more than recommended in ${(overcommitmentRate * 100).toFixed(0)}% of weeks.`,
                recommendation: 'Consider if this allocation aligns with overall academic goals.',
                data: { overcommitmentRate: overcommitmentRate, weeksAnalyzed: entries.length }
            });
        }
        
        const skippedRate = entries.filter(e => e.completionStatus === 'skipped').length / entries.length;
        const lowExecutionRate = entries.filter(e => e.actualHours < plan.recommendedHours * 0.5).length / entries.length;
        if (plan.priorityScore >= 3.5 && (skippedRate > 0.3 || lowExecutionRate > 0.4)) {
            insights.push({
                type: 'priority_misalignment', subjectName: plan.subjectName, maturity: INSIGHT_MATURITY.PATTERN,
                message: `${plan.subjectName}: High priority but frequently skipped or under-executed.`,
                recommendation: 'Consider re-evaluating priority factors or identifying barriers to execution.',
                data: { priorityScore: plan.priorityScore, skippedRate: skippedRate, lowExecutionRate: lowExecutionRate }
            });
        }
        
        if (entries.length >= 3) {
            const hours = entries.map(e => e.actualHours);
            const mean = hours.reduce((sum, h) => sum + h, 0) / hours.length;
            const variance = hours.reduce((sum, h) => sum + Math.pow(h - mean, 2), 0) / hours.length;
            const cv = mean > 0 ? Math.sqrt(variance) / mean : 0;
            
            if (cv < 0.15) {
                insights.push({
                    type: 'high_consistency', subjectName: plan.subjectName, maturity: INSIGHT_MATURITY.PATTERN,
                    message: `${plan.subjectName}: Very consistent execution pattern.`,
                    recommendation: 'This reliability can be used to improve planning for other subjects.',
                    data: { coefficientOfVariation: cv, meanHours: mean }
                });
            } else if (cv > 0.5) {
                insights.push({
                    type: 'low_consistency', subjectName: plan.subjectName, maturity: INSIGHT_MATURITY.PATTERN,
                    message: `${plan.subjectName}: Highly variable execution pattern.`,
                    recommendation: 'Consider identifying factors causing variability.',
                    data: { coefficientOfVariation: cv, meanHours: mean }
                });
            }
        }
    });
    return insights;
}

function generateBehavioralInsights(executionLogs, weeklyPlans, subjects) {
    const insights = [];
    
    const weeklyTotals = executionLogs.map(log => {
        const totalPlanned = weeklyPlans.reduce((sum, p) => sum + p.recommendedHours, 0);
        const totalActual = log.entries.reduce((sum, e) => sum + e.actualHours, 0);
        return { ratio: totalPlanned > 0 ? totalActual / totalPlanned : 0 };
    });
    const avgRatio = weeklyTotals.reduce((sum, w) => sum + w.ratio, 0) / weeklyTotals.length;
    
    if (avgRatio < 0.7 && weeklyTotals.length >= 3) {
        insights.push({
            type: 'overconfidence_bias', subjectName: 'Overall Planning', maturity: INSIGHT_MATURITY.BEHAVIORAL,
            message: `Overconfidence bias detected: You consistently plan ${((1 - avgRatio) * 100).toFixed(0)}% more than you execute.`,
            recommendation: 'Consider adding 20-30% buffer to all plans or using historical execution rates to calibrate.',
            data: { averageExecutionRatio: avgRatio, weeksAnalyzed: weeklyTotals.length }
        });
    }
    
    const highDifficultySubjects = subjects.filter(s => s.difficulty >= 4);
    highDifficultySubjects.forEach(subject => {
        const plan = weeklyPlans.find(p => p.subjectId === subject.id);
        if (!plan) return;
        const entries = executionLogs.flatMap(log => log.entries.filter(e => e.subjectId === subject.id));
        if (entries.length < 3) return;
        
        const avgExecutionRate = entries.reduce((sum, e) => {
            return sum + (plan.recommendedHours > 0 ? e.actualHours / plan.recommendedHours : 0);
        }, 0) / entries.length;
        
        if (avgExecutionRate < 0.5) {
            insights.push({
                type: 'avoidance_pattern', subjectName: subject.name, maturity: INSIGHT_MATURITY.BEHAVIORAL,
                message: `${subject.name}: High difficulty subject executed at ${(avgExecutionRate * 100).toFixed(0)}% rate.`,
                recommendation: 'Consider breaking down into smaller tasks or scheduling at peak energy times.',
                data: { difficulty: subject.difficulty, executionRate: avgExecutionRate }
            });
        }
    });
    
    weeklyPlans.forEach(plan => {
        const entries = executionLogs.flatMap(log => log.entries.filter(e => e.subjectId === plan.subjectId));
        if (entries.length < 3) return;
        
        const exceededCount = entries.filter(e => e.actualHours > plan.recommendedHours * 1.3).length;
        const exceededRate = exceededCount / entries.length;
        
        if (exceededRate > 0.4 && plan.recommendedHours < 5) {
            insights.push({
                type: 'planning_fallacy', subjectName: plan.subjectName, maturity: INSIGHT_MATURITY.BEHAVIORAL,
                message: `${plan.subjectName}: Planning fallacy detected. Actual execution exceeded plans in ${(exceededRate * 100).toFixed(0)}% of weeks.`,
                recommendation: 'Consider using historical data to calibrate estimates or adding time buffers.',
                data: { exceededRate: exceededRate, initialPlan: plan.recommendedHours }
            });
        }
    });
    
    return insights;
}
