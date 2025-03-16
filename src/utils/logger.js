import { format as _format, createLogger, transports as _transports } from 'winston'
import { join } from 'path'
import 'dotenv/config';

class LoggerConfig {
  constructor () {
    this.loggerFormat = _format.printf(({ level, message, timestamp }) => {
      return `[${timestamp}] ${level}: ${message}`
    })

    this.logger = createLogger({
      format: _format.combine(
        _format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        this.loggerFormat
      ),
      transports: [
        new _transports.Console(),
        new _transports.File({
          filename: join(process.env.LOGS, 'error.log'),
          level: 'error',
          maxsize: 5 * 1024 * 1024,
          format: _format.combine(
            _format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
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

export default new LoggerConfig()
