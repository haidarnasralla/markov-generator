const MarkovGenerator = require('./markov-generator.js');
const readline = require('readline');

// Sample corpus - replace with your own
const corpus = `
The quick brown fox jumps over the lazy dog. The lazy dog sleeps all day long.
The brown fox is quick and clever. Quick foxes are hard to catch.
Dogs love to chase foxes but this lazy dog prefers to sleep.
All day the fox runs and jumps while the dog dreams of chasing.
The forest was dark and deep. Shadows moved between the ancient trees.
Moonlight filtered through the leaves, casting silver patterns on the ground.
An owl hooted in the distance. The night creatures stirred and whispered.
Stars twinkled above the canopy, indifferent to the world below.
Time passed slowly in the forest. Seasons came and went like breathing.
`;

const generator = new MarkovGenerator();
generator.train(corpus);

// State
let mode = 'word';
let order = 3;
let length = 30;

function generate() {
  console.log('\n' + '─'.repeat(60));
  console.log(`Mode: ${mode.toUpperCase()}  |  Order: ${order}  |  Length: ${length}`);
  console.log('─'.repeat(60));
  
  try {
    const output = generator.generate({ length, mode, order });
    console.log('\n' + output + '\n');
  } catch (e) {
    console.log('\nError: ' + e.message + '\n');
  }
}

function showHelp() {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║  MARKOV DIAL CONTROLS                                      ║
╠════════════════════════════════════════════════════════════╣
║  m / mode      Toggle between 'word' and 'char' mode       ║
║  + / up        Increase order (more coherent)              ║
║  - / down      Decrease order (more chaotic)               ║
║  o <n>         Set order directly (1-10)                   ║
║  l <n>         Set output length                           ║
║  g / generate  Generate with current settings              ║
║  Enter         Generate (shortcut)                         ║
║  h / help      Show this help                              ║
║  q / quit      Exit                                        ║
╚════════════════════════════════════════════════════════════╝
`);
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('\n🎛️  MARKOV GENERATOR - Interactive Mode\n');
showHelp();
generate();

function prompt() {
  rl.question('> ', (input) => {
    const cmd = input.trim().toLowerCase();
    const parts = cmd.split(/\s+/);

    switch (parts[0]) {
      case '':
      case 'g':
      case 'generate':
        generate();
        break;

      case 'm':
      case 'mode':
        mode = mode === 'word' ? 'char' : 'word';
        console.log(`Mode: ${mode}`);
        generate();
        break;

      case '+':
      case 'up':
        order = Math.min(10, order + 1);
        console.log(`Order: ${order}`);
        generate();
        break;

      case '-':
      case 'down':
        order = Math.max(1, order - 1);
        console.log(`Order: ${order}`);
        generate();
        break;

      case 'o':
      case 'order':
        const newOrder = parseInt(parts[1]);
        if (newOrder >= 1 && newOrder <= 10) {
          order = newOrder;
          console.log(`Order: ${order}`);
          generate();
        } else {
          console.log('Order must be 1-10');
        }
        break;

      case 'l':
      case 'length':
        const newLength = parseInt(parts[1]);
        if (newLength > 0) {
          length = newLength;
          console.log(`Length: ${length}`);
          generate();
        } else {
          console.log('Length must be positive');
        }
        break;

      case 'h':
      case 'help':
        showHelp();
        break;

      case 'q':
      case 'quit':
      case 'exit':
        console.log('Bye!');
        rl.close();
        process.exit(0);
        break;

      default:
        // Try parsing as just a number (quick order change)
        const num = parseInt(cmd);
        if (num >= 1 && num <= 10) {
          order = num;
          console.log(`Order: ${order}`);
          generate();
        } else {
          console.log('Unknown command. Type "h" for help.');
        }
    }

    prompt();
  });
}

prompt();
