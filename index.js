import { parse, addDays, differenceInDays, startOfDay, isAfter, isBefore, isEqual, format, isToday, isTomorrow, isValid} from 'date-fns';
import * as readline from 'readline'
import * as fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import open from 'open';
import chalk from 'chalk';


const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const referencePath = path.join(__dirname, 'ImportanceReference.png');

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
  return (hours * 60 + minutes) * 1.4;
}

function minutesToDifficulty(minutes) {
  if (minutes <= 10) return 1;
  if (minutes <= 20) return 2;
  if (minutes <= 45) return 3;
  if (minutes <= 65) return 4;
  if (minutes <= 95) return 5;
  if (minutes <= 120) return 6;
  if (minutes <= 180) return 7;
  if (minutes <= 300) return 8;
  if (minutes <= 570) return 9;
  if (minutes <= 1000) return 10;
  return null;
}

function parseDueDate(dueDateString) {
  if (!dueDateString) return null;

  const dateFormat = 'MM dd HH yyyy';
  const now = new Date();
  const currentYear = now.getFullYear();

  let parsedDate = parse(dueDateString + ' ' + currentYear, dateFormat, new Date());

  if (!isValid(parsedDate)) {
    console.log("Invalid date format. Please use MM DD HH [YYYY]");
    return null;
  }

  return parsedDate;
}

function calculateUrgency(dueDateString, timeEstimate) {
  if (!dueDateString) return 1;

  const now = new Date();
  const dueDate = new Date(dueDateString);
  const hoursUntilDue = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60);

  // Convert timeEstimate to hours
  const [hours, minutes] = timeEstimate.split(':').map(Number);
  const estimatedHours = hours + minutes / 60;

  // Calculate urgency based on time until due date
  let timeUrgency;
  if (hoursUntilDue <= 0) timeUrgency = 10;
  else if (hoursUntilDue <= 24) timeUrgency = 9;
  else if (hoursUntilDue <= 48) timeUrgency = 8;
  else if (hoursUntilDue <= 72) timeUrgency = 7;
  else if (hoursUntilDue <= 120) timeUrgency = 6;
  else if (hoursUntilDue <= 168) timeUrgency = 5; // 7 days
  else if (hoursUntilDue <= 336) timeUrgency = 4; // 14 days
  else if (hoursUntilDue <= 504) timeUrgency = 3; // 21 days
  else if (hoursUntilDue <= 672) timeUrgency = 2; // 28 days
  else timeUrgency = 1;

  // Calculate urgency based on estimated time
  let estimateUrgency;
  if (estimatedHours >= 10) estimateUrgency = 10;
  else if (estimatedHours >= 8) estimateUrgency = 9;
  else if (estimatedHours >= 6) estimateUrgency = 8;
  else if (estimatedHours >= 4) estimateUrgency = 7;
  else if (estimatedHours >= 3) estimateUrgency = 6;
  else if (estimatedHours >= 2) estimateUrgency = 5;
  else if (estimatedHours >= 1.5) estimateUrgency = 4;
  else if (estimatedHours >= 1) estimateUrgency = 3;
  else if (estimatedHours >= 0.5) estimateUrgency = 2;
  else estimateUrgency = 1;

  // Combine both urgencies, giving more weight to the time-based urgency
  return Math.round((timeUrgency * 0.5) + (estimateUrgency * 0.5));
}

async function splitTask() {
  displayTasks();
  const indexToSplit = parseInt(await askQuestion("Enter the number of the task to split (or 0 to cancel): ")) - 1;

  if (indexToSplit === -1) {
    console.log("Split cancelled.");
    return;
  }

  if (indexToSplit >= 0 && indexToSplit < tasks.length) {
    const task = tasks[indexToSplit];
    console.log(`Splitting task: "${task.taskName}"`);

    const numSubtasks = parseInt(await askQuestion("How many subtasks do you want to create? "));

    for (let i = 0; i < numSubtasks; i++) {
      const subtaskName = await askQuestion(`Enter name for subtask ${i + 1}: `);
      const subtaskTimeEstimate = await askQuestion(`Estimated time for subtask ${i + 1} (HH:MM format): `);

      const subtask = {
        taskName: `${subtaskName}`,
        difficulty: minutesToDifficulty(timeToMinutes(subtaskTimeEstimate)),
        dueDate: task.dueDate,
        importance: task.importance,
        timeEstimate: subtaskTimeEstimate
      };

      tasks.push(subtask);
    }

    tasks.splice(indexToSplit, 1); // Remove the original task
    console.log("Task split successfully.");
    saveTasks();
  } else {
    console.log("Invalid task number.");
  }
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
  let importance = await askQuestion("Importance (1-10, 10 is most important) (or type 'x' to bring up importance reference): ");
  if (importance === 'x') {
    openReferenceImage()
    importance = parseInt(await askQuestion("Importance (1-10, 10 is most important):"));
  } else {
    importance = parseInt(importance)
  }

  tasks.push({ taskName, difficulty, dueDate, importance, timeEstimate });
  saveTasks();
  return true;
}

function calculatePriority(task) {
  const now = new Date();
  const dueDate = task.dueDate ? new Date(task.dueDate) : null;
  const timeUntilDue = dueDate ? (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24) : Infinity;
  
  const urgency = calculateUrgency(task.dueDate, task.timeEstimate);
  
  // Convert timeEstimate to hours
  const [hours, minutes] = task.timeEstimate.split(':').map(Number);
  const estimatedHours = hours + minutes / 60;

  // Prioritize tasks due soon and tasks that take longer
  const dueDateFactor = dueDate ? Math.max(0, 10 - timeUntilDue) : 0;
  const timeFactor = Math.min(10, estimatedHours);

  return (
    urgency * 3 +
    task.importance * 2 +
    dueDateFactor * 2 +
    timeFactor +
    (11 - task.difficulty)
  );
}

function sortTasks() {
  return tasks.sort((a, b) => calculatePriority(b) - calculatePriority(a));
}

function classifyTask(task) {
  const urgency = calculateUrgency(task.dueDate, task.timeEstimate);
  if (task.importance > 5 && urgency > 5) return "Do";
  if (task.importance > 5 && urgency <= 5) return "Schedule";
  if (task.importance <= 5 && urgency > 5) return "Delegate";
  return "Eliminate";
}

function displayTasks() {
  console.log("\nCurrent tasks:");
  const now = new Date();
  sortTasks().forEach((task, index) => {
    const urgency = calculateUrgency(task.dueDate, task.timeEstimate);
    const classification = classifyTask(task);

    const dueDate = task.dueDate ? new Date(task.dueDate) : null
    const isOverdue = dueDate && dueDate <= now;

    console.log(`\x1b[1m\x1b[96m${index + 1}. ${task.taskName}\x1b[0m${isOverdue ? ' \x1b[31mOVERDUE\x1b[0m' : ''}`);
    console.log(`   Time Estimate: ${task.timeEstimate}, Difficulty: ${task.difficulty}, Urgency: ${urgency}, Importance: ${task.importance}`);
    console.log(`   Due Date: \x1b[35m${task.dueDate ? new Date(task.dueDate).toLocaleString() : 'Not set'} \x1b[0m`);
    console.log(`   Eisenhower's Classification: ${classification}`);
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
    console.log(`Current due date for "${task.taskName}": ${task.dueDate ? new Date(task.dueDate).toLocaleString() : 'Not set'}`);
    const dueDateString = await askQuestion("Due date (MM DD HH [YYYY], or leave blank if no due date): ");
    const dueDate = parseDueDate(dueDateString);

    task.dueDate = dueDate;

    console.log(`Updated due date for "${task.taskName}" to ${task.dueDate ? new Date(task.dueDate).toLocaleString() : 'Not set'}`);
    saveTasks();
  } else {
    console.log("Invalid task number.");
  }
}

async function updateTimeEstimate() {
  displayTasks();
  const indexToUpdate = parseInt(await askQuestion("Enter the number of the task to update time estimate (or 0 to cancel): ")) - 1;

  if (indexToUpdate === -1) {
    console.log("Update cancelled.");
    return;
  }

  if (indexToUpdate >= 0 && indexToUpdate < tasks.length) {
    const task = tasks[indexToUpdate];
    console.log(`Current time estimate for "${task.taskName}": ${task.timeEstimate}`);
    const timeEstimate = await askQuestion("Estimated time to completion (HH:MM format): ");
    const minutes = timeToMinutes(timeEstimate);
    const difficulty = minutesToDifficulty(minutes);

    if (difficulty === null) {
      console.log("Tasks this large should be broken up into smaller subtasks. Please try again.");
      return true;
    }

    task.timeEstimate = timeEstimate
    task.difficulty = difficulty
    console.log(`Updated time estimate for "${task.taskName}" to ${timeEstimate}`);
    saveTasks();
  }
}

async function openReferenceImage() {
  open(referencePath)
}

function calculateDailyWorkHours() {
  const now = startOfDay(new Date());
  const oneWeekLater = addDays(now, 7);
  const dailyHours = Array(7).fill(0);

  tasks.forEach(task => {
    if (!task.dueDate) { return }
    const dueDate = new Date(task.dueDate);
    const [hours, minutes] = task.timeEstimate.split(':').map(Number);
    const totalHours = hours + minutes / 60;

    if (isBefore(dueDate, now) || isEqual(dueDate, now)) {
      // Task is overdue or due today, add all hours to today
      dailyHours[0] += totalHours;
    } else if (isBefore(dueDate, oneWeekLater)) {
      const daysUntilDue = differenceInDays(dueDate, now);
      const hoursPerDay = totalHours / (daysUntilDue + 1);

      for (let i = 0; i <= daysUntilDue && i < 7; i++) {
        dailyHours[i] += hoursPerDay;
      }
    }
  });

  return dailyHours;
}

function displayDailyWorkHours() {
  const dailyHours = calculateDailyWorkHours();
  const today = new Date();
  let weeklyHours = 0;
  console.log("\nEstimated work hours for the next week:\n");
  let todayHours = 0

  dailyHours.forEach((hours, index) => {
    const day = addDays(today, index);
    let dayLabel;

    if (isToday(day)) {
      dayLabel = chalk.yellow.bold("Today") + "\t";
      todayHours = hours
    } else if (isTomorrow(day)) {
      dayLabel = chalk.yellow.bold("Tmrw") + "\t";
    } else {
      dayLabel = chalk.yellow(format(day, 'EEEE')); // Full day name for other days
    }

    const dateStr = chalk.yellow(format(day, 'MMM d')); // Date in the format "Mar 15"
    const coloredHours = hours > 4
      ? chalk.red(hours.toFixed(2).padStart(5))
      : hours > 2
        ? chalk.yellow(hours.toFixed(2).padStart(5))
        : chalk.green(hours.toFixed(2).padStart(5))
    console.log(`${dayLabel.padEnd(20)} ${dateStr.padEnd(15)} ${coloredHours} hours`);
    weeklyHours += hours;
  });

  console.log("\n" + "─".repeat(50));
  console.log("You have " + weeklyHours.toFixed(1) + " hours of work total to complete this week")
  console.log("Theoretically you could complete all your tasks for this week with \nonly " + chalk.cyan.bold((weeklyHours / 7).toFixed(1) + " hours of work per day"))
  console.log("\nBut rather because of your time management until this day, you have\n" + chalk.red.bold(todayHours.toFixed(1) + " hours") + " of work to complete today.")
  if(todayHours < (weeklyHours / 7) + 1.5) {
    console.log("Congratulations! You have been managing your time really well lately!! Here's a cookie! 🍪")
  } else {
    console.log("It seems like you have been managing your time somewhat poorly. No cookie today. ❌🙅‍♂️❌")
  }


  let totalHours = 0;
  tasks.forEach((task) => {
    const [hours, minutes] = task.timeEstimate.split(':').map(Number);
    totalHours += hours + minutes / 60;
  });

  console.log("\n" + "─".repeat(50));
  console.log("You have " + totalHours.toFixed(1) + " hours of work total to complete total")
  console.log("Theoretically you could complete all your tasks " + chalk.cyan.bold("PERIOD") + " with \nonly " + chalk.cyan.bold((weeklyHours / 7).toFixed(1) + " hours of work per day"))
}

async function main() {
  console.clear();
  console.log("Welcome to...");
  console.log(`                                                          
┏┳┓┓┏┏┓  ┏┓┳┳┳┓┏┓╻╻
 ┃ ┣┫┣   ┃ ┃┃┣┫┣ ┃┃
 ┻ ┛┗┗┛  ┗┛┗┛┻┛┗┛••                                                                                                                                                                                                
`);
  loadTasks();

  while (true) {
    console.log("\nChoose an action:");
    console.log("1. Add tasks");
    console.log("2. View tasks");
    console.log("3. Delete a task");
    console.log("4. Update task due date");
    console.log("5. View reference for importance");
    console.log("6. Update task time estimate");
    console.log("7. Split a task into subtasks");
    console.log("8. View daily work hours");
    console.log("9. Exit");


    const choice = await askQuestion("Enter your choice (1-9): ");

    switch (choice) {
      case '1':
        console.log("\nEnter your tasks, estimated time to completion, due date, and importance.");
        console.log("Time should be in HH:MM format. Due date should be in MM DD HH [YYYY] format.");
        console.log("Importance is on a scale of 1-10. Type 'done' when you've finished entering tasks.");
        while (await inputTask()) { }
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
        await openReferenceImage();
        break;
      case '6':
        await updateTimeEstimate();
        break;
      case '7':
        await splitTask();
        break;
      case '8':
        displayDailyWorkHours();
        break;
      case '9':
        console.log("Thank you for using the Eisenhower Matrix Task Prioritizer. Goodbye!");
        rl.close();
        return;
      default:
        console.log("Invalid choice. Please try again.");
    }
  }
}

main();