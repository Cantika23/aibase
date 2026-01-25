// Test backtick concatenation
const result = '`' + '`' + '`typescript\nconst x = 1;\n' + '`' + '`' + '`';
console.log(result);
console.log('---');
console.log('Expected: ```typescript\\nconst x = 1;\\n```');
