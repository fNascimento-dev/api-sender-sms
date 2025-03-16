import 'dotenv/config';
import './core/providers/index.js';
import logger from './utils/logger.js';
import { rabbitmqConfig } from './config/rabbitmq-config.js';
import RabbitMQConnection from './messaging/connection/rabbitmq-connection.js';
import SmsMessageConsumer from './messaging/consumers/sms-message-consumer.js';

// Array para armazenar as conexões e consumidores
const connections = [];
const consumers = [];

/**
 * Inicializa as conexões com o RabbitMQ e configura os consumidores
 */
async function initializeRabbitMQ() {
  try {
    logger.info('Iniciando conexões com RabbitMQ');

    // Inicializar cada conexão configurada
    for (const config of rabbitmqConfig) {
      logger.info(`Configurando conexão para vhost: ${config.vhost}, fila: ${config.queueName}`);
      
      // Criar conexão
      const connection = new RabbitMQConnection(config);
      await connection.connect();
      
      // Criar consumidor
      const consumer = new SmsMessageConsumer(connection, {
        queueName: config.queueName,
        maxConcurrent: config.prefetch || 10
      });
      
      // Iniciar consumo
      await consumer.startConsuming();
      
      // Armazenar referências
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

/**
 * Configura o encerramento gracioso da aplicação
 */
function setupGracefulShutdown() {
  const shutdown = async (signal) => {
    logger.info(`Sinal ${signal} recebido. Iniciando encerramento gracioso`);

    // Parar consumidores
    for (const consumer of consumers) {
      try {
        await consumer.stopConsuming();
      } catch (err) {
        logger.error(`Erro ao parar consumidor: ${err.message}`);
      }
    }

    // Fechar conexões
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

  // Registrar handlers para sinais de encerramento
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  
  // Capturar exceções não tratadas
  process.on('uncaughtException', (err) => {
    logger.error(`Exceção não tratada: ${err.message}`, { stack: err.stack });
    
    // Iniciar encerramento gracioso
    shutdown('uncaughtException').catch(() => {
      process.exit(1);
    });
  });
  
  // Capturar rejeições de promessas não tratadas
  process.on('unhandledRejection', (reason, promise) => {
    logger.error(`Rejeição de promessa não tratada: ${reason instanceof Error ? reason.message : String(reason)}`, { 
      stack: reason instanceof Error ? reason.stack : undefined 
    });
  });
}

/**
 * Função principal que inicia a aplicação
 */
async function startApplication() {
  logger.info('Iniciando aplicação de processamento de SMS');
  
  try {
    // Configurar encerramento gracioso
    setupGracefulShutdown();
    
    // Inicializar conexões com RabbitMQ
    await initializeRabbitMQ();
    
    logger.info('Aplicação iniciada com sucesso e pronta para processar mensagens');
    
    // Manter processo ativo
    setInterval(() => {
      const activeConnections = connections.filter(conn => conn.isConnected).length;
      logger.info(`Estado da aplicação: ${activeConnections}/${connections.length} conexões ativas`);
    }, 60000); // Log a cada minuto
  } catch (error) {
    logger.error(`Falha ao iniciar aplicação: ${error.message}`, { stack: error.stack });
    process.exit(1);
  }
}

// Iniciar aplicação
startApplication();