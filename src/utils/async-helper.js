import logger from './logger.js';

/**
 * Utilitários para lidar com operações assíncronas
 */
class AsyncHelper {
  /**
   * Executa uma operação assíncrona com retries em caso de falha
   * 
   * @param {Function} operation - Função assíncrona a ser executada
   * @param {Object} options - Opções de configuração
   * @param {number} options.retries - Número máximo de tentativas (padrão: 3)
   * @param {number} options.initialDelay - Delay inicial em ms (padrão: 1000)
   * @param {number} options.maxDelay - Delay máximo em ms (padrão: 30000)
   * @param {Function} options.shouldRetry - Função que determina se deve tentar novamente (padrão: sempre)
   * @returns {Promise<any>} Resultado da operação
   */
  static async withRetry(operation, options = {}) {
    const retries = options.retries || 3;
    const initialDelay = options.initialDelay || 1000;
    const maxDelay = options.maxDelay || 30000;
    const shouldRetry = options.shouldRetry || (() => true);
    const context = options.context || 'operação';
    
    let lastError;
    
    for (let attempt = 1; attempt <= retries + 1; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        // Verificar se devemos tentar novamente
        if (attempt > retries || !shouldRetry(error)) {
          logger.error(`Falha definitiva em ${context} após ${attempt} tentativas: ${error.message}`);
          throw error;
        }
        
        // Calcular delay com backoff exponencial e jitter
        const baseDelay = Math.min(initialDelay * Math.pow(2, attempt - 1), maxDelay);
        const jitter = baseDelay * 0.2 * Math.random(); // 20% jitter
        const delay = Math.floor(baseDelay + jitter);
        
        logger.warn(`Tentativa ${attempt}/${retries + 1} falhou para ${context}. Tentando novamente em ${delay}ms`);
        
        // Aguardar antes da próxima tentativa
        await AsyncHelper.sleep(delay);
      }
    }
  }
  
  /**
   * Executa uma operação assíncrona com timeout
   * 
   * @param {Promise} promise - Promessa a ser executada
   * @param {number} timeoutMs - Timeout em milissegundos
   * @param {string} operationName - Nome da operação para logs
   * @returns {Promise<any>} Resultado da operação
   * @throws {Error} Erro de timeout se a operação demorar mais que o timeout
   */
  static async withTimeout(promise, timeoutMs, operationName = 'operação') {
    let timeoutId;
    
    // Criar promessa de timeout
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`Timeout de ${timeoutMs}ms excedido para ${operationName}`));
      }, timeoutMs);
    });
    
    try {
      // Executar promessa com race para implementar timeout
      return await Promise.race([
        promise,
        timeoutPromise
      ]);
    } finally {
      // Sempre limpar o timeout
      clearTimeout(timeoutId);
    }
  }
  
  /**
   * Executa uma operação sem bloquear o event loop principal
   * Útil para operações longas que não precisam de resultado imediato
   * 
   * @param {Function} operation - Função a ser executada
   * @param {Object} options - Opções adicionais
   * @returns {Promise<void>} Promessa que resolve imediatamente
   */
  static fireAndForget(operation, options = {}) {
    const { logErrors = true, context = 'operação' } = options;
    
    // Executar em próximo tick para não bloquear
    Promise.resolve().then(async () => {
      try {
        await operation();
      } catch (error) {
        if (logErrors) {
          logger.error(`Erro em fire-and-forget ${context}: ${error.message}`, { 
            stack: error.stack
          });
        }
      }
    });
    
    // Retornar promessa resolvida imediatamente
    return Promise.resolve();
  }
  
  /**
   * Função de sleep (espera) assíncrona
   * 
   * @param {number} ms - Tempo de espera em milissegundos
   * @returns {Promise<void>} Promessa que resolve após o tempo especificado
   */
  static sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Executa múltiplas operações em paralelo com limite de concorrência
   * 
   * @param {Array<Function>} operations - Array de funções que retornam promessas
   * @param {number} concurrency - Número máximo de operações simultâneas
   * @returns {Promise<Array>} Array com resultados na mesma ordem das operações
   */
  static async limitConcurrency(operations, concurrency = 5) {
    if (!operations || operations.length === 0) {
      return [];
    }
    
    const results = new Array(operations.length);
    let operationIndex = 0;
    
    // Função que processa uma única operação
    const processOperation = async () => {
      while (operationIndex < operations.length) {
        const currentIndex = operationIndex++;
        
        try {
          results[currentIndex] = await operations[currentIndex]();
        } catch (error) {
          results[currentIndex] = { error };
        }
      }
    };
    
    // Criar "workers" baseados no limite de concorrência
    const workers = Array(Math.min(concurrency, operations.length))
      .fill()
      .map(() => processOperation());
    
    // Aguardar todos os workers completarem
    await Promise.all(workers);
    
    return results;
  }
}

export default AsyncHelper;