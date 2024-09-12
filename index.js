const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const tasks = [];

function askQuestion(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function inputTask() {
  console.log("\nEnter task details (or type 'done' to finish):");
  const taskName = await askQuestion("Task Name: ");
  
  if (taskName.toLowerCase() === 'done') {
    return false;
  }

  const difficulty = parseInt(await askQuestion("Difficulty (1-10, 1 is easiest): "));
  const urgency = parseInt(await askQuestion("Urgency (1-10, 10 is most urgent): "));
  const importance = parseInt(await askQuestion("Importance (1-10, 10 is most important): "));

  tasks.push({ taskName, difficulty, urgency, importance });
  return true;
}

function calculatePriority(task) {
  // Higher priority for easy, urgent, and important tasks
  return (11 - task.difficulty) + task.urgency + task.importance;
}

function sortTasks() {
  return tasks.sort((a, b) => calculatePriority(b) - calculatePriority(a));
}

function classifyTask(task) {
  if (task.importance > 5 && task.urgency > 5) return "Do";
  if (task.importance > 5 && task.urgency <= 5) return "Schedule";
  if (task.importance <= 5 && task.urgency > 5) return "Delegate";
  return "Consider Elimination";
}

function displayResults() {
  console.log("\nTasks sorted by priority (highest priority first):");
  sortTasks().forEach((task, index) => {
    const classification = classifyTask(task);
    console.log(`${index + 1}. ${task.taskName}`);
    console.log(`   Difficulty: ${task.difficulty}, Urgency: ${task.urgency}, Importance: ${task.importance}`);
    console.log(`   Classification: ${classification}`);
    console.log();
  });
}

async function main() {
  console.log("Welcome to the Eisenhower Matrix Task Prioritizer!");
  console.log("Enter your tasks and their ratings for Difficulty, Urgency, and Importance.");
  console.log("Each rating is on a scale of 1-10.");
  console.log("Type 'done' when you've finished entering tasks.\n");

  while (await inputTask()) {}

  displayResults();
  rl.close();
}

main();