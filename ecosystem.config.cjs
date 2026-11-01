module.exports = {
  apps: [{
    name: 'number-garden-2048',
    cwd: __dirname,
    script: 'artifacts/g028-build-fix2/src/server/index.js',
    interpreter: 'C:/Program Files/nodejs/node.exe',
    args: ['--host', '0.0.0.0', '--port', '3116'],
    instances: 1,
    exec_mode: 'fork',
    watch: false,
    time: true,
    restart_delay: 1000,
  }],
};
