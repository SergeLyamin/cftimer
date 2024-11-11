module.exports = {
  apps : [{
    name: "timer",
    script: "server.js",
    env: {
      NODE_ENV: "development",
      BASE_URL: "http://localhost:3000"
    },
    env_production: {
      NODE_ENV: "production",
      PORT: 3000,
      BASE_URL: "https://timer.lyamin.org"
    }
  }]
} 