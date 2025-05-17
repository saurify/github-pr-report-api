import chalk from 'chalk';

export function logInfo(message) {
  console.log(chalk.blue(`[INFO] ${message}`));
}

export function logError(message) {
  console.error(chalk.red(`[ERROR] ${message}`));
}
