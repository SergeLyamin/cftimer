module.exports = {
  apps : [{
    name: "timer",
    script: "server.js",
    env: {
      NODE_ENV: "development",
    },
    env_production: {
      NODE_ENV: "production",
      PORT: 3001,
      BASE_URL: "https://timer.lyamin.org"
    }
  }]
} 