const logger = require('../../utils/logger')
class MessageParser {
  messageToSend = (msg) => {
    try {
      const parsed = {
        VERSAO_PROTOCOLO: msg.slice(0, 3).trim(),
        NR_TERMINAL: msg.slice(3, 14).trim(),
        CD_OPERADORA: msg.slice(16, 19).trim(),
        PRIORIDADE: msg.slice(19, 20).trim(),
        DT_CRIACAO: msg.slice(20, 34).trim(),
        DT_AGENDA: msg.slice(34, 48).trim(),
        TEMPO_VALIDADE: msg.slice(48, 55).trim(),
        RECIBO: msg.slice(55, 63).trim(),
        MSG_ID: msg.slice(63, 83).trim(),
        PORTA: msg.slice(83, 85).trim(),
        CD_MCI: msg.slice(85, 94).trim(),
        ID_CLIENTE: msg.slice(94, 134).trim(),
        SYSTEM_MQ: msg.slice(134, 137).trim(),
        CATEGORIA: msg.slice(137, 141).trim(),
        CD_MSG: msg.slice(141, 145).trim(),
        VERSAO_MSG: msg.slice(145, 148).trim(),
        TAMANHO_MSG: msg.slice(148, 151).trim(),
        MENSAGEM: msg.slice(151, 296).trim()
      }
      return parsed
    } catch (error) {
      logger.error('Error parsing message:', error.message)
      throw error
    }
  }
}

module.exports = MessageParser
