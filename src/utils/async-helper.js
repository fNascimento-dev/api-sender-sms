import logger from './logger.js';
class AsyncHelper {
 
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
        
        if (attempt > retries || !shouldRetry(error)) {
          logger.error(`Falha definitiva em ${context} após ${attempt} tentativas: ${error.message}`);
          throw error;
        }
        
        const baseDelay = Math.min(initialDelay * Math.pow(2, attempt - 1), maxDelay);
        const jitter = baseDelay * 0.2 * Math.random(); 
        const delay = Math.floor(baseDelay + jitter);
        
        logger.warn(`Tentativa ${attempt}/${retries + 1} falhou para ${context}. Tentando novamente em ${delay}ms`);
        
        await AsyncHelper.sleep(delay);
      }
    }
  }
  

  static async withTimeout(promise, timeoutMs, operationName = 'operação') {
    let timeoutId;
    
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`Timeout de ${timeoutMs}ms excedido para ${operationName}`));
      }, timeoutMs);
    });
    
    try {
      return await Promise.race([
        promise,
        timeoutPromise
      ]);
    } finally {
      clearTimeout(timeoutId);
    }
  }
  

  static fireAndForget(operation, options = {}) {
    const { logErrors = true, context = 'operação' } = options;
    
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
    
    return Promise.resolve();
  }
  

  static sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  

  static async limitConcurrency(operations, concurrency = 5) {
    if (!operations || operations.length === 0) {
      return [];
    }
    
    const results = new Array(operations.length);
    let operationIndex = 0;
    
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
    
    const workers = Array(Math.min(concurrency, operations.length))
      .fill()
      .map(() => processOperation());
    
    await Promise.all(workers);
    
    return results;
  }
}

export default AsyncHelper;