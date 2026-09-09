// Diagnostic Test Script for Experiment 10 BGP State Engine and Endpoints
const http = require('http');

async function testExp10Endpoints() {
    console.log('🧪 Starting Experiment 10 Diagnostic Test...');

    // Test 1: Verify data/experiment10.js can be loaded
    try {
        const fs = require('fs');
        const path = require('path');
        const code = fs.readFileSync(path.join(__dirname, '../data/experiment10.js'), 'utf8');
        const sandbox = {};
        const fn = new Function(code + '; return experimentData;');
        const expData = fn();
        if (typeof expData === 'object' && expData.title && expData.quiz.length === 5) {
            console.log('✅ Experiment 10 data file validated successfully.');
        } else {
            console.error('❌ Experiment 10 data file format mismatch.');
        }
    } catch (e) {
        console.error('❌ Failed to parse data/experiment10.js:', e.message);
    }

    // Test 2: Verify quiz key resolution
    try {
        const path = require('path');
        const { evaluateServerQuiz } = require(path.join(__dirname, '../lib/quiz-keys'));
        const mockAnswers = [
            { questionIndex: 0, selectedIndex: 1 },
            { questionIndex: 1, selectedIndex: 2 },
            { questionIndex: 2, selectedIndex: 0 },
            { questionIndex: 3, selectedIndex: 1 },
            { questionIndex: 4, selectedIndex: 2 }
        ];
        const res = evaluateServerQuiz(10, mockAnswers);
        if (res.passed && res.percentage === 100) {
            console.log('✅ Experiment 10 server-side quiz key validation passed (100%).');
        } else {
            console.error('❌ Quiz evaluation failed:', res);
        }
    } catch (e) {
        console.error('❌ Error evaluating quiz keys for Exp 10:', e.message);
    }

    console.log('🎉 Diagnostic testing complete!');
}

testExp10Endpoints();
