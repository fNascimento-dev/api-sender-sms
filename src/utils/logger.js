const winston = require('winston')
const path = require('path')
require('dotenv').config()

class LoggerConfig {
  constructor () {
    this.loggerFormat = winston.format.printf(({ level, message, timestamp }) => {
      return `[${timestamp}] ${level}: ${message}`
    })

    this.logger = winston.createLogger({
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        this.loggerFormat
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({
          filename: path.join(process.env.LOGS, 'error.log'),
          level: 'error',
          maxsize: 5 * 1024 * 1024,
          format: winston.format.combine(
            winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            this.loggerFormat
          )
        })
      ]
    })
  }

  info (message) {
    this.logger.info(message)
  }

  error (message) {
    this.logger.error(message)
  }

  warn (message) {
    this.logger.warn(message)
  }
}

module.exports = new LoggerConfig()
