import fs from 'fs';
import path from 'path';

const ROOT_DIR = process.cwd();
const APP_DIR = path.join(ROOT_DIR, 'app');

let violations = 0;

function report(file: string, message: string) {
  console.error(`❌ [Violation] ${file}: ${message}`);
  violations++;
}

function walk(dir: string, callback: (file: string) => void) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (file === 'node_modules' || file === '.next' || file === '.git') continue;
      walk(fullPath, callback);
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      callback(fullPath);
    }
  }
}

/**
 * 1. Check for backend imports in /app
 */
function checkAppImports() {
  const forbiddenPatterns = [
    /from ['"]@\/lib\/queue\/worker['"]/,
    /from ['"]@\/lib\/services\/.*(service|limiter|budget|broker|adapter|scraper|processor).*['"]/,
  ];

  if (fs.existsSync(APP_DIR)) {
    walk(APP_DIR, (file) => {
      const content = fs.readFileSync(file, 'utf8');
      for (const pattern of forbiddenPatterns) {
        if (pattern.test(content)) {
          report(file, 'Forbidden backend import detected in /app directory. Use dynamic imports or ServiceProxy.');
        }
      }
    });
  }
}

/**
 * 2. Check for missing groupId in queue.add()
 */
function checkQueueAdditions() {
  walk(ROOT_DIR, (file) => {
    const relativePath = path.relative(ROOT_DIR, file);
    if (relativePath.startsWith('node_modules') || relativePath.startsWith('.next')) return;
    // Don't scan ourselves
    if (relativePath === 'scripts/check-queue-compliance.ts') return;

    const content = fs.readFileSync(file, 'utf8');
    // Find all .add( calls
    const contentToSearch = content;
    let pos = 0;
    while ((pos = contentToSearch.indexOf('.add(', pos)) !== -1) {
      const start = pos;
      let end = -1;
      let braceCount = 0;
      let parenCount = 0;

      // Find the balancing closing parenthesis
      for (let i = start + 4; i < contentToSearch.length; i++) {
        const char = contentToSearch[i];
        if (char === '(') parenCount++;
        if (char === ')') {
          if (parenCount === 0) {
            end = i + 1;
            break;
          }
          parenCount--;
        }
      }

      if (end !== -1) {
        const call = contentToSearch.substring(start, end);
        // Only check if it looks like a BullMQ add with multiple arguments
        // Arguments are usually: name, data, options
        const args = call.substring(5, call.length - 1);

        // Split arguments by top-level commas (ignoring commas inside {} or [])
        const topLevelArgs = [];
        let currentArg = '';
        let depth = 0;
        let inString = false;
        let stringChar = '';

        for (let i = 0; i < args.length; i++) {
          const c = args[i];
          if ((c === "'" || c === '"' || c === '`') && args[i-1] !== '\\') {
            if (!inString) {
              inString = true;
              stringChar = c;
            } else if (c === stringChar) {
              inString = false;
            }
          }
          if (!inString) {
            if (c === '{' || c === '[') depth++;
            if (c === '}' || c === ']') depth--;
            if (c === ',' && depth === 0) {
              topLevelArgs.push(currentArg.trim());
              currentArg = '';
              continue;
            }
          }
          currentArg += c;
        }
        topLevelArgs.push(currentArg.trim());

        if (topLevelArgs.length >= 3) {
          const options = topLevelArgs[2];
          if (!options.includes('groupId')) {
            report(file, `Detected queue.add() with options but missing mandatory 'groupId': ${call.trim().substring(0, 100)}...`);
          }
        } else if (topLevelArgs.length === 2 && !call.includes('SEED')) {
          // Only flag if the first argument is a string literal (BullMQ pattern: queue.add("name", data))
          // This skips Set.add(value), Map.add(key), etc.
          const firstArg = topLevelArgs[0].trim();
          const isProbablyQueue = /^['"`]/.test(firstArg);

          if (isProbablyQueue) {
            report(file, `Detected queue.add() without options object (missing 'groupId'): ${call.trim()}`);
          }
        }
      }
      pos += 4;
    }
  });
}

function run() {
  console.log('🛡️  Running PricePilot Queue Compliance Check...');

  checkAppImports();
  checkQueueAdditions();

  if (violations > 0) {
    console.log(`\n🚨 Total violations found: ${violations}`);
    console.log('Please refer to docs/DEVELOPER_GUIDELINES_QUEUE.md for fixing instructions.');
    process.exit(1);
  } else {
    console.log('✅ All queue compliance checks passed!');
  }
}

run();
