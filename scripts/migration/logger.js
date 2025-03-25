const fs = require('fs').promises;
const path = require('path');
const config = require('./config');

class Logger {
  constructor() {
    this.logs = [];
    this.startTime = Date.now();
    this.logFile = path.join(config.paths.outputDir, 'migration.log');
  }

  formatMessage(message) {
    if (typeof message === 'object') {
      return JSON.stringify(message, null, 2);
    }
    return String(message);
  }

  log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const formattedLevel = String(level).toUpperCase();
    const formattedMessage = this.formatMessage(message);
    const logEntry = `[${timestamp}] [${formattedLevel}] ${formattedMessage}`;

    console.log(logEntry);
    this.logs.push(logEntry);
  }

  error(message, error = null) {
    let errorMessage = this.formatMessage(message);
    if (error) {
      errorMessage += `\n${error.stack || error.message || this.formatMessage(error)}`;
    }
    this.log(errorMessage, 'error');
  }

  warn(message) {
    this.log(message, 'warn');
  }

  success(message) {
    this.log(message, 'success');
  }

  async saveLog() {
    try {
      await fs.mkdir(config.paths.outputDir, { recursive: true });
      await fs.writeFile(
        this.logFile,
        this.logs.join('\n') + '\n',
        { flag: 'a' }
      );
    } catch (error) {
      console.error('Failed to save log file:', error);
    }
  }

  getDuration() {
    const duration = Date.now() - this.startTime;
    const seconds = Math.floor(duration / 1000);
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ${seconds % 60}s`;
  }
}

module.exports = new Logger(); 