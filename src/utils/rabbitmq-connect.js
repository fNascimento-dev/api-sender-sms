const amqplib = require("amqplib");
const logger = require("../utils/logger");

require("dotenv").config();

class RabbitMQConsumer {
  /**
   * @param {Object} config - Configuração da conexão
   * @param {string} config.url - URL de conexão com o RabbitMQ
   * @param {string} config.vhost - VHost a ser conectado
   * @param {string} config.queueName - Nome da fila a ser consumida
   * @param {Object} config.options - Opções adicionais de conexão
   */
  constructor(config) {
    this.config = config;
    this.connection = null;
    this.channel = null;
    this.isConnected = false;
    this.isConsuming = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = config.maxReconnectAttempts || 10;
    this.reconnectDelay = config.reconnectDelay || 5000;
  }

  /**
   * Conecta ao RabbitMQ
   * 
   * @returns {Promise<void>}
   */
  async connect() {
    try {
      const connectionUrl = this.config.url.includes('vhost=') ? 
        this.config.url : 
        `${this.config.url}/${encodeURIComponent(this.config.vhost)}`;
      
      logger.info(`Conectando ao RabbitMQ: ${connectionUrl}`);
      this.connection = await amqplib.connect(connectionUrl, {heartbeat: this.config.options.heartbeat});
      
      this.connection.on('error', (err) => {
        logger.error(`Erro na conexão com RabbitMQ no vhost ${this.config.vhost} - ${err}`);
        this.isConnected = false;
        this.reconnect();
      });
      
      this.connection.on('close', () => {
        logger.warn(`Conexão com RabbitMQ fechada no vhost ${this.config.vhost}`);
        this.isConnected = false;
        this.reconnect();
      });
      
      this.channel = await this.connection.createChannel();
      
      await this.channel.prefetch(this.config.prefetch || 10);
      
      await this.channel.assertQueue(this.config.queueName, {
        durable: true,
        ...this.config.queueOptions
      });
      
      this.isConnected = true;
      this.reconnectAttempts = 0;
      logger.info(`Conectado ao RabbitMQ no vhost ${this.config.vhost}, fila ${this.config.queueName}`);
    } catch (error) {
      logger.error(`Falha ao conectar ao RabbitMQ no vhost ${this.config.vhost} - ${error}`, );
      this.isConnected = false;
      this.reconnect();
    }
  }

  /**
   * Reconecta ao RabbitMQ após erro ou fechamento
   */
  async reconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error(`Número máximo de tentativas de reconexão atingido para o vhost ${this.config.vhost}`);
      return;
    }
    
    this.reconnectAttempts++;
    
    const delay = this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1);
    
    logger.info(`Tentando reconectar ao RabbitMQ no vhost ${this.config.vhost} em ${delay}ms (tentativa ${this.reconnectAttempts})`);
    
    setTimeout(async () => {
      try {
        await this.connect();
        if (this.isConsuming) {
          await this.startConsuming();
        }
      } catch (error) {
        logger.error(`Falha na tentativa de reconexão ao RabbitMQ no vhost ${this.config.vhost}`, error);
      }
    }, delay);
  }

  /**
   * Inicia o consumo de mensagens
   * 
   * @returns {Promise<void>}
   */
  async startConsuming() {
    if (!this.isConnected) {
      await this.connect();
    }
    
    try {
      logger.info(`Iniciando consumo na fila ${this.config.queueName} no vhost ${this.config.vhost}`);
      
      await this.channel.consume(this.config.queueName, async (message) => {
        if (!message) return;
        
        try {
          const content = message.content.toString();
          this.logger.debug(`Mensagem recebida na fila ${this.config.queueName}`, { 
            vhost: this.config.vhost,
            messageId: message.properties.messageId
          });
          
          const messageData = JSON.parse(content);
          
          await this.processMessage(messageData, message.properties);
          
          this.channel.ack(message);
        } catch (error) {
          logger.error(`Erro ao processar mensagem da fila ${this.config.queueName}`, error);
          
          if (message.properties.headers && message.properties.headers['x-retry-count']) {
            const retryCount = message.properties.headers['x-retry-count'];
            
            if (retryCount < (this.config.maxRetries || 3)) {
              this.channel.publish(
                '',
                this.config.queueName,
                message.content,
                {
                  headers: {
                    'x-retry-count': retryCount + 1,
                    'x-original-error': error.message
                  },
                  persistent: true
                }
              );
              
              this.channel.ack(message);
              logger.warn(`Mensagem reenfileirada para retry (${retryCount + 1}/${this.config.maxRetries || 3})`);
            } else {
              if (this.config.deadLetterQueue) {
                this.channel.publish(
                  '',
                  this.config.deadLetterQueue,
                  message.content,
                  {
                    headers: {
                      'x-original-error': error.message,
                      'x-max-retries-exceeded': true
                    },
                    persistent: true
                  }
                );
                logger.warn(`Mensagem enviada para dead-letter queue após ${retryCount} tentativas`);
              }
              
              this.channel.ack(message);
            }
          } else {
            this.channel.publish(
              '',
              this.config.queueName,
              message.content,
              {
                headers: {
                  'x-retry-count': 1,
                  'x-original-error': error.message
                },
                persistent: true
              }
            );
            
            this.channel.ack(message);
            logger.warn('Primeira falha, mensagem reenfileirada para retry');
          }
        }
      }, { noAck: false, consumerTag: this.config.consumerTag });
      
      this.isConsuming = true;
      logger.info(`Consumo iniciado na fila ${this.config.queueName} no vhost ${this.config.vhost}`);
    } catch (error) {
      logger.error(`Falha ao iniciar consumo na fila ${this.config.queueName}`, error);
      this.isConsuming = false;
      throw error;
    }
  }

  /**
   * Processa uma mensagem recebida
   * 
   * @param {Object} messageData - Dados da mensagem
   * @param {Object} properties - Propriedades da mensagem do RabbitMQ
   * @returns {Promise<Object>} Resultado do processamento
   */
  async processMessage(messageData, properties) {
    if (!messageData.to || !messageData.text) {
      throw new Error('Mensagem inválida: campos obrigatórios ausentes (to, text)');
    }
    
    logger.info('Processando mensagem SMS da fila', { 
      to: messageData.to,
      messageId: properties.messageId,
      vhost: this.config.vhost,
      queue: this.config.queueName
    });
    
   }

  /**
   * Para o consumo de mensagens
   * 
   * @returns {Promise<void>}
   */
  async stopConsuming() {
    if (this.channel && this.isConsuming) {
      try {
        await this.channel.cancel(this.config.consumerTag);
        this.isConsuming = false;
        logger.info(`Consumo interrompido na fila ${this.config.queueName} no vhost ${this.config.vhost}`);
      } catch (error) {
        logger.error(`Erro ao interromper consumo na fila ${this.config.queueName}`, error);
      }
    }
  }

  /**
   * Fecha a conexão com o RabbitMQ
   * 
   * @returns {Promise<void>}
   */
  async close() {
    try {
      if (this.isConsuming) {
        await this.stopConsuming();
      }
      
      if (this.channel) {
        await this.channel.close();
      }
      
      if (this.connection) {
        await this.connection.close();
      }
      
      this.isConnected = false;
      logger.info(`Conexão com RabbitMQ fechada no vhost ${this.config.vhost}`);
    } catch (error) {
      logger.error(`Erro ao fechar conexão com RabbitMQ no vhost ${this.config.vhost} - ${error}`, );
    }
  }
}

module.exports = RabbitMQConsumer;
