module.exports = {
  apps: [{
    name: 'number-garden-2048',
    cwd: __dirname,
    script: 'artifacts/g032-build/src/server/index.js',
    interpreter: 'C:/Program Files/nodejs/node.exe',
    args: ['--host', '0.0.0.0', '--port', '15010'],
    instances: 1,
    exec_mode: 'fork',
    watch: false,
    time: true,
    restart_delay: 1000,
  }],
};
