const app = require('../src/app').app
const logger = require('../src/utils/logger')
const rabbit = require('../src/utils/rabbitmq-connect')
const config = require('../src/config/rabbitmq-config')

async function setupRabbitMQ() {
  try {
    const connections = [];
    
    for (const rabbitConfig of config.rabbitmqConfig) {
      const connection = new rabbit(rabbitConfig);
      await connection.connect();
      await connection.startConsuming();
      connections.push(connection);
      logger.info(`RABBITMQ: Conectado ao vhost ${rabbitConfig.vhost}`);
    }
    
    global.rabbitConnections = connections;
    
  } catch (error) {
    logger.error(`RABBITMQ: Erro ao configurar RabbitMQ: ${error}`);
  }
}

setupRabbitMQ();

app.listen(3021, () => {
  logger.info('Executando app');
});