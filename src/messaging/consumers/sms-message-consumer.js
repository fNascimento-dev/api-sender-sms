import logger from '../../utils/logger.js';
import SmsMessageHandler from '../handlers/sms-message-handler.js';

/**
 * Consumidor de mensagens de SMS da fila do RabbitMQ
 */
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

  /**
   * Inicia o consumo de mensagens
   */
  async startConsuming() {
    try {
      // Garantir que temos uma conexão
      const channel = await this.connection.ensureConnection();
      
      logger.info(`Iniciando consumo da fila ${this.queueName}`);
      
      // Configurar o consumo da fila
      await channel.consume(
        this.queueName,
        async (message) => {
          if (!message) {
            return;
          }

          try {
            // Controlar o número de mensagens processadas concorrentemente
            this.activeMessages++;
            
            // Extrair conteúdo da mensagem
            const content = message.content.toString();
            const messageId = message.properties.messageId || 'unknown';
            
            logger.info(`Recebida mensagem ${messageId} da fila ${this.queueName}`);
            
            try {
              // Converter JSON para objeto
              const messageData = JSON.parse(content);
              
              // Processar mensagem assíncronamente
              this._processMessageNonBlocking(channel, message, messageData);
            } catch (parseError) {
              logger.error(`Erro ao parsear mensagem JSON: ${parseError.message}`);
              
              // Rejeitar mensagem mal formatada e enviar para DLQ
              channel.reject(message, false);
              this.activeMessages--;
            }
          } catch (error) {
            logger.error(`Erro ao processar mensagem: ${error.message}`);
            
            // Em caso de erro genérico, nack com requeue
            channel.nack(message, false, true);
            this.activeMessages--;
          }
        },
        { noAck: false }
      );
      
      this.isConsuming = true;
      logger.info(`Consumo iniciado na fila ${this.queueName}`);
      
      // Monitorar eventos de conexão
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

  /**
   * Processa a mensagem sem bloquear o consumo da fila
   * Implementa o padrão "fire and forget" para não esperar a resposta do envio
   */
  _processMessageNonBlocking(channel, message, messageData) {
    // Iniciar processamento assíncrono
    this.handler.handle(messageData)
      .then(() => {
        // Processamento bem-sucedido, confirmar mensagem
        channel.ack(message);
        logger.info(`Mensagem ${message.properties.messageId || 'unknown'} processada com sucesso`);
      })
      .catch(error => {
        logger.error(`Erro no processamento da mensagem: ${error.message}`);
        
        // Verificar headers de retry
        const headers = message.properties.headers || {};
        const retryCount = headers['x-retry-count'] || 0;
        
        if (retryCount < 3) {
          // Republica a mensagem com contador de retry incrementado
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
          
          // Confirmar recebimento da mensagem original
          channel.ack(message);
          logger.warn(`Mensagem reenfileirada para retry (${retryCount + 1}/3)`);
        } else {
          // Excedeu número de retries, enviar para DLQ
          logger.warn(`Máximo de tentativas excedido, mensagem descartada`);
          channel.reject(message, false);
        }
      })
      .finally(() => {
        this.activeMessages--;
      });
  }

  /**
   * Para o consumo de mensagens
   */
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