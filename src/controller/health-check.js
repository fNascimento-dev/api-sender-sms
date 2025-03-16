class HealthCheck {
  /**
     *
     * @param {*} req
     * @param {*} res
     */
  async checkStatus (req, res) {
    res.status(200).json({ timestamp: new Date().toISOString(), service: 'ok' })
  }
}

module.exports = new HealthCheck()
