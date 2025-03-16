import 'dotenv/config';
import './core/providers/index.js';
import logger from './utils/logger.js';
import { rabbitmqConfig } from './config/rabbitmq-config.js';
import RabbitMQConnection from './messaging/connection/rabbitmq-connection.js';
import SmsMessageConsumer from './messaging/consumers/sms-message-consumer.js';

const connections = [];
const consumers = [];


async function initializeRabbitMQ() {
  try {
    logger.info('Iniciando conexões com RabbitMQ');

    for (const config of rabbitmqConfig) {
      logger.info(`Configurando conexão para vhost: ${config.vhost}, fila: ${config.queueName}`);
      
      const connection = new RabbitMQConnection(config);
      await connection.connect();
      
      const consumer = new SmsMessageConsumer(connection, {
        queueName: config.queueName,
        maxConcurrent: config.prefetch || 10
      });
      
      await consumer.startConsuming();
      
      connections.push(connection);
      consumers.push(consumer);
      
      logger.info(`Consumidor iniciado para fila ${config.queueName}`);
    }

    logger.info(`${connections.length} conexões com RabbitMQ estabelecidas com sucesso`);
  } catch (error) {
    logger.error(`Falha ao inicializar conexões com RabbitMQ: ${error.message}`);
    throw error;
  }
}


function setupGracefulShutdown() {
  const shutdown = async (signal) => {
    logger.info(`Sinal ${signal} recebido. Iniciando encerramento gracioso`);

    for (const consumer of consumers) {
      try {
        await consumer.stopConsuming();
      } catch (err) {
        logger.error(`Erro ao parar consumidor: ${err.message}`);
      }
    }

    for (const connection of connections) {
      try {
        await connection.close();
      } catch (err) {
        logger.error(`Erro ao fechar conexão RabbitMQ: ${err.message}`);
      }
    }

    logger.info('Encerramento gracioso concluído');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  
  process.on('uncaughtException', (err) => {
    logger.error(`Exceção não tratada: ${err.message}`, { stack: err.stack });
    
    shutdown('uncaughtException').catch(() => {
      process.exit(1);
    });
  });
  
  process.on('unhandledRejection', (reason, promise) => {
    logger.error(`Rejeição de promessa não tratada: ${reason instanceof Error ? reason.message : String(reason)}`, { 
      stack: reason instanceof Error ? reason.stack : undefined 
    });
  });
}


async function startApplication() {
  logger.info('Iniciando aplicação de processamento de SMS');
  
  try {
    setupGracefulShutdown();
    
    await initializeRabbitMQ();
    
    logger.info('Aplicação iniciada com sucesso e pronta para processar mensagens');
    
    setInterval(() => {
      const activeConnections = connections.filter(conn => conn.isConnected).length;
      logger.info(`Estado da aplicação: ${activeConnections}/${connections.length} conexões ativas`);
    }, 60000); 
  } catch (error) {
    logger.error(`Falha ao iniciar aplicação: ${error.message}`, { stack: error.stack });
    process.exit(1);
  }
}

startApplication();