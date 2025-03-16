import amqplib from 'amqplib';
import EventEmitter from 'events';
import logger from '../../utils/logger.js';

/**
 * Gerencia a conexão com o RabbitMQ de forma resiliente
 */
class RabbitMQConnection extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.connection = null;
    this.channel = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = config.maxReconnectAttempts || 10;
    this.reconnectDelay = config.reconnectDelay || 5000;
  }

  /**
   * Estabelece conexão com o RabbitMQ
   */
  async connect() {
    try {
      const connectionUrl = this.config.url.includes('vhost=') ? 
        this.config.url : 
        `${this.config.url}/${encodeURIComponent(this.config.vhost)}`;
      
      logger.info(`Conectando ao RabbitMQ: ${connectionUrl}`);
      this.connection = await amqplib.connect(connectionUrl, {heartbeat: this.config.options.heartbeat});
      
      // Configurar handlers de eventos para a conexão
      this.connection.on('error', (err) => {
        logger.error(`Erro na conexão com RabbitMQ: ${err.message}`);
        this.isConnected = false;
        this._reconnect();
      });
      
      this.connection.on('close', () => {
        logger.warn('Conexão com RabbitMQ fechada');
        this.isConnected = false;
        this._reconnect();
      });
      
      // Criar canal
      this.channel = await this.connection.createChannel();
      
      // Configurar prefetch
      await this.channel.prefetch(this.config.prefetch || 10);
      
      // Garantir que a fila existe
      await this.channel.assertQueue(this.config.queueName, {
        durable: true,
        ...this.config.queueOptions
      });
      
      // Configurar fila de mensagens mortas se necessário
      if (this.config.deadLetterQueue) {
        await this.channel.assertQueue(this.config.deadLetterQueue, {
          durable: true
        });
      }
      
      this.isConnected = true;
      this.reconnectAttempts = 0;
      logger.info(`Conectado ao RabbitMQ, fila ${this.config.queueName}`);
      
      // Emitir evento de conexão estabelecida
      this.emit('connected', this.channel);
      
      return this.channel;
    } catch (error) {
      logger.error(`Falha ao conectar ao RabbitMQ: ${error.message}`);
      this.isConnected = false;
      this._reconnect();
      throw error;
    }
  }

  /**
   * Implementa lógica de reconexão com backoff exponencial
   */
  _reconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('Número máximo de tentativas de reconexão atingido');
      this.emit('reconnectFailed');
      return;
    }
    
    this.reconnectAttempts++;
    
    // Backoff exponencial com jitter (variação aleatória)
    const baseDelay = this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1);
    const jitter = Math.random() * 0.3 * baseDelay; // 30% de variação
    const delay = baseDelay + jitter;
    
    logger.info(`Tentando reconectar em ${Math.round(delay)}ms (tentativa ${this.reconnectAttempts})`);
    
    setTimeout(() => {
      this.connect().catch(err => {
        logger.error(`Falha na tentativa de reconexão: ${err.message}`);
      });
    }, delay);
  }

  /**
   * Fecha a conexão com o RabbitMQ
   */
  async close() {
    try {
      if (this.channel) {
        await this.channel.close();
      }
      
      if (this.connection) {
        await this.connection.close();
      }
      
      this.isConnected = false;
      logger.info('Conexão com RabbitMQ fechada');
    } catch (error) {
      logger.error(`Erro ao fechar conexão com RabbitMQ: ${error.message}`);
    }
  }

  /**
   * Verifica se a conexão está ativa e reconecta se necessário
   */
  async ensureConnection() {
    if (!this.isConnected || !this.channel) {
      return this.connect();
    }
    return this.channel;
  }
}

export default RabbitMQConnection;