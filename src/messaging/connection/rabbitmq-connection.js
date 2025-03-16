import amqplib from "amqplib";
import EventEmitter from "events";
import logger from "../../utils/logger.js";


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

  async connect() {
    try {
      const connectionUrl = this.config.url.includes("vhost=")
        ? this.config.url
        : `${this.config.url}/${encodeURIComponent(this.config.vhost)}`;

      logger.info(`Conectando ao RabbitMQ: ${connectionUrl}`);
      this.connection = await amqplib.connect(connectionUrl, {
        heartbeat: this.config.options.heartbeat,
      });

      this.connection.on("error", (err) => {
        logger.error(`Erro na conexão com RabbitMQ: ${err.message}`);
        this.isConnected = false;
        this._reconnect();
      });

      this.connection.on("close", () => {
        logger.warn("Conexão com RabbitMQ fechada");
        this.isConnected = false;
        this._reconnect();
      });

      this.channel = await this.connection.createChannel();

      await this.channel.prefetch(this.config.prefetch || 10);

      await this.channel.assertQueue(this.config.queueName, {
        durable: true,
        ...this.config.queueOptions,
      });

      if (this.config.deadLetterQueue) {
        await this.channel.assertQueue(this.config.deadLetterQueue, {
          durable: true,
        });
      }

      this.isConnected = true;
      this.reconnectAttempts = 0;
      logger.info(`Conectado ao RabbitMQ, fila ${this.config.queueName}`);

      this.emit("connected", this.channel);

      return this.channel;
    } catch (error) {
      logger.error(`Falha ao conectar ao RabbitMQ: ${error.message}`);
      this.isConnected = false;
      this._reconnect();
      throw error;
    }
  }

  _reconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error("Número máximo de tentativas de reconexão atingido");
      this.emit("reconnectFailed");
      return;
    }

    this.reconnectAttempts++;

    const baseDelay =
      this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1);
    const jitter = Math.random() * 0.3 * baseDelay;
    const delay = baseDelay + jitter;

    logger.info(
      `Tentando reconectar em ${Math.round(delay)}ms (tentativa ${
        this.reconnectAttempts
      })`
    );

    setTimeout(() => {
      this.connect().catch((err) => {
        logger.error(`Falha na tentativa de reconexão: ${err.message}`);
      });
    }, delay);
  }

  async close() {
    try {
      if (this.channel) {
        await this.channel.close();
      }

      if (this.connection) {
        await this.connection.close();
      }

      this.isConnected = false;
      logger.info("Conexão com RabbitMQ fechada");
    } catch (error) {
      logger.error(`Erro ao fechar conexão com RabbitMQ: ${error.message}`);
    }
  }

  async ensureConnection() {
    if (!this.isConnected || !this.channel) {
      return this.connect();
    }
    return this.channel;
  }
}

export default RabbitMQConnection;
