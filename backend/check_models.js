const fs = require('fs');
const path = require('path');

// Let's inspect the files in frontend/public/models
const dir = 'c:/Users/sgoud/Downloads/coronary_angiogram_ai_starter_antigravity/frontend/public/models';
fs.readdirSync(dir).forEach(file => {
  const stat = fs.statSync(path.join(dir, file));
  console.log(`${file}: ${(stat.size / 1024 / 1024).toFixed(2)} MB`);
});
