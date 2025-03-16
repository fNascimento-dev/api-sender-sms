const express = require('express')
const StartSend = require('../src/routers/app-routes')

class App {
  constructor () {
    this.app = express()
    this.middlewares()
    this.route()
  }

  /**
  * Rotas da aplicação
  */
  route () {
    this.app.use(StartSend)
  }

  /**
  * Método para aplicação de middlewares
  */
  middlewares () {
    this.app.use(express.json())
  }
}

module.exports = new App()
