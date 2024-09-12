const readline = require('readline');
const fs = require('fs');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const DB_FILE = 'tasks.json';

let tasks = [];

function askQuestion(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

function loadTasks() {
  try {
    const data = fs.readFileSync(DB_FILE, 'utf8');
    tasks = JSON.parse(data);
  } catch (error) {
    tasks = [];
  }
}

function saveTasks() {
  fs.writeFileSync(DB_FILE, JSON.stringify(tasks, null, 2));
}

function timeToMinutes(timeString) {
  const [hours, minutes] = timeString.split(':').map(Number);
  return (hours * 60 + minutes) * 1.5;
}

function minutesToDifficulty(minutes) {
  if (minutes <= 5) return 1;
  if (minutes <= 15) return 2;
  if (minutes <= 30) return 3;
  if (minutes <= 45) return 4;
  if (minutes <= 60) return 5;
  if (minutes <= 80) return 6;
  if (minutes <= 100) return 7;
  if (minutes <= 120) return 8;
  if (minutes <= 165) return 9;
  if (minutes <= 240) return 10;
  return null;
}

function parseDueDate(dueDateString) {
  if (!dueDateString) return null;

  const now = new Date();
  const currentYear = now.getFullYear();
  
  let [month, day, hour, year] = dueDateString.split(' ').map(Number);
  
  if (isNaN(year)) {
    year = currentYear;
  }

  return new Date(year, month - 1, day, hour);
}

function calculateUrgency(dueDate) {
  if (!dueDate) return 1;

  const now = new Date();
  const hoursUntilDue = (dueDate - now) / (1000 * 60 * 60);

  if (hoursUntilDue <= 0) return 10;  // Overdue tasks get highest urgency
  if (hoursUntilDue <= 12) return 10;
  if (hoursUntilDue <= 24) return 9;
  if (hoursUntilDue <= 36) return 8;
  if (hoursUntilDue <= 48) return 7;
  if (hoursUntilDue <= 60) return 6;
  if (hoursUntilDue <= 72) return 5;
  if (hoursUntilDue <= 168) return 4; // 7 days
  if (hoursUntilDue <= 240) return 3; // 10 days
  if (hoursUntilDue <= 360) return 2; // 15 days
  if (hoursUntilDue <= 720) return 1; // 30 days
  return 1; // More than 30 days
}

async function inputTask() {
  console.log("\nEnter task details (or type 'done' to finish):");
  const taskName = await askQuestion("Task Name: ");
  
  if (taskName.toLowerCase() === 'done') {
    return false;
  }

  const timeEstimate = await askQuestion("Estimated time to completion (HH:MM format): ");
  const minutes = timeToMinutes(timeEstimate);
  const difficulty = minutesToDifficulty(minutes);

  if (difficulty === null) {
    console.log("Tasks this large should be broken up into smaller subtasks. Please try again.");
    return true;
  }

  const dueDateString = await askQuestion("Due date (MM DD HH [YYYY], or leave blank if no due date): ");
  const dueDate = parseDueDate(dueDateString);
  const importance = parseInt(await askQuestion("Importance (1-10, 10 is most important): "));

  tasks.push({ taskName, difficulty, dueDate, importance, timeEstimate });
  saveTasks();
  return true;
}

function calculatePriority(task) {
  const urgency = calculateUrgency(task.dueDate);
  return (11 - task.difficulty) + urgency + task.importance;
}

function sortTasks() {
  return tasks.sort((a, b) => calculatePriority(b) - calculatePriority(a));
}

function classifyTask(task) {
  const urgency = calculateUrgency(task.dueDate);
  if (task.importance > 5 && urgency > 5) return "Do";
  if (task.importance > 5 && urgency <= 5) return "Schedule";
  if (task.importance <= 5 && urgency > 5) return "Delegate";
  return "Eliminate";
}

function displayTasks() {
  console.log("\nCurrent tasks:");
  sortTasks().forEach((task, index) => {
    const urgency = calculateUrgency(task.dueDate);
    const classification = classifyTask(task);
    const now = new Date();
    const isOverdue = task.dueDate && task.dueDate < now;

    console.log(`${index + 1}. ${task.taskName}${isOverdue ? ' \x1b[31mOVERDUE\x1b[0m' : ''}`);
    console.log(`   Time Estimate: ${task.timeEstimate}, Difficulty: ${task.difficulty}, Urgency: ${urgency}, Importance: ${task.importance}`);
    console.log(`   Due Date: ${task.dueDate ? task.dueDate.toLocaleString() : 'Not set'}`);
    console.log(`   Classification: ${classification}`);
    console.log();
  });
}

async function deleteTask() {
  displayTasks();
  const indexToDelete = parseInt(await askQuestion("Enter the number of the task to delete (or 0 to cancel): ")) - 1;
  
  if (indexToDelete === -1) {
    console.log("Deletion cancelled.");
    return;
  }

  if (indexToDelete >= 0 && indexToDelete < tasks.length) {
    const deletedTask = tasks.splice(indexToDelete, 1)[0];
    console.log(`Deleted task: ${deletedTask.taskName}`);
    saveTasks();
  } else {
    console.log("Invalid task number.");
  }
}

async function updateDueDate() {
  displayTasks();
  const indexToUpdate = parseInt(await askQuestion("Enter the number of the task to update due date (or 0 to cancel): ")) - 1;
  
  if (indexToUpdate === -1) {
    console.log("Update cancelled.");
    return;
  }

  if (indexToUpdate >= 0 && indexToUpdate < tasks.length) {
    const task = tasks[indexToUpdate];
    console.log(`Current due date for "${task.taskName}": ${task.dueDate ? task.dueDate.toLocaleString() : 'Not set'}`);
    const newDueDateString = await askQuestion("Enter new due date (MM DD HH [YYYY], or leave blank to remove): ");
    
    task.dueDate = parseDueDate(newDueDateString);
    console.log(`Updated due date for "${task.taskName}" to ${task.dueDate ? task.dueDate.toLocaleString() : 'Not set'}`);
    saveTasks();
  } else {
    console.log("Invalid task number.");
  }
}

async function main() {
  console.log("Welcome to the Eisenhower Matrix Task Prioritizer!");
  loadTasks();

  while (true) {
    console.log("\nChoose an action:");
    console.log("1. Add tasks");
    console.log("2. View tasks");
    console.log("3. Delete a task");
    console.log("4. Update task due date");
    console.log("5. Exit");

    const choice = await askQuestion("Enter your choice (1-5): ");

    switch (choice) {
      case '1':
        console.log("\nEnter your tasks, estimated time to completion, due date, and importance.");
        console.log("Time should be in HH:MM format. Due date should be in MM DD HH [YYYY] format.");
        console.log("Importance is on a scale of 1-10. Type 'done' when you've finished entering tasks.");
        while (await inputTask()) {}
        break;
      case '2':
        displayTasks();
        break;
      case '3':
        await deleteTask();
        break;
      case '4':
        await updateDueDate();
        break;
      case '5':
        console.log("Thank you for using the Eisenhower Matrix Task Prioritizer. Goodbye!");
        rl.close();
        return;
      default:
        console.log("Invalid choice. Please try again.");
    }
  }
}

main();