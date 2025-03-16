const { Router } = require('express')
const HealthCheck = require('../controller/health-check')
const route = new Router()

route.get('/health', (req, res) => HealthCheck.checkStatus(req, res))

module.exports = route
