import logger from '../../utils/logger.js';
import SmsMessageHandler from '../handlers/sms-message-handler.js';

class SmsMessageConsumer {
  constructor(rabbitConnection, config = {}) {
    this.connection = rabbitConnection;
    this.handler = new SmsMessageHandler();
    this.queueName = config.queueName;
    this.consumerTag = `sms_consumer_${Math.random().toString(36).substring(2, 10)}`;
    this.maxConcurrent = config.maxConcurrent || 10;
    this.activeMessages = 0;
    this.isConsuming = false;
  }

 
  async startConsuming() {
    try {
      const channel = await this.connection.ensureConnection();
      
      logger.info(`Iniciando consumo da fila ${this.queueName}`);
      
      await channel.consume(
        this.queueName,
        async (message) => {
          if (!message) {
            return;
          }

          try {
            this.activeMessages++;
            
            const content = message.content.toString();
            const messageId = message.properties.messageId || 'unknown';
            
            logger.info(`Recebida mensagem ${messageId} da fila ${this.queueName}`);
            
            try {
              const messageData = JSON.parse(content);
              
              this._processMessageNonBlocking(channel, message, messageData);
            } catch (parseError) {
              logger.error(`Erro ao parsear mensagem JSON: ${parseError.message}`);
              
              channel.reject(message, false);
              this.activeMessages--;
            }
          } catch (error) {
            logger.error(`Erro ao processar mensagem: ${error.message}`);
            
            channel.nack(message, false, true);
            this.activeMessages--;
          }
        },
        { noAck: false }
      );
      
      this.isConsuming = true;
      logger.info(`Consumo iniciado na fila ${this.queueName}`);
      
      this.connection.on('connected', () => {
        if (!this.isConsuming) {
          this.startConsuming().catch(err => {
            logger.error(`Falha ao reiniciar consumo: ${err.message}`);
          });
        }
      });
    } catch (error) {
      logger.error(`Falha ao iniciar consumo: ${error.message}`);
      throw error;
    }
  }

  _processMessageNonBlocking(channel, message, messageData) {
    this.handler.handle(messageData)
      .then(() => {
        channel.ack(message);
        logger.info(`Mensagem ${message.properties.messageId || 'unknown'} processada com sucesso`);
      })
      .catch(error => {
        logger.error(`Erro no processamento da mensagem: ${error.message}`);
        
        const headers = message.properties.headers || {};
        const retryCount = headers['x-retry-count'] || 0;
        
        if (retryCount < 3) {
          channel.publish(
            '',
            this.queueName,
            message.content,
            {
              headers: {
                ...headers,
                'x-retry-count': retryCount + 1,
                'x-last-error': error.message
              }
            }
          );
          
          channel.ack(message);
          logger.warn(`Mensagem reenfileirada para retry (${retryCount + 1}/3)`);
        } else {
          logger.warn(`Máximo de tentativas excedido, mensagem descartada`);
          channel.reject(message, false);
        }
      })
      .finally(() => {
        this.activeMessages--;
      });
  }


  async stopConsuming() {
    try {
      const channel = await this.connection.ensureConnection();
      await channel.cancel(this.consumerTag);
      this.isConsuming = false;
      logger.info(`Consumo interrompido na fila ${this.queueName}`);
    } catch (error) {
      logger.error(`Erro ao interromper consumo: ${error.message}`);
    }
  }
}

export default SmsMessageConsumer;