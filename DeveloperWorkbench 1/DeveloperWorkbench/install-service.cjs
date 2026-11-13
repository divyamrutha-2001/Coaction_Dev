const path = require('path');
const Service = require('node-windows').Service;

const root = __dirname;
const svc = new Service({
  name: 'CoAction API',
  description: 'Express backend for CoAction',
  script: path.join(root, 'backend', 'server.js'),
  env: [
    { name: 'NODE_ENV', value: 'production' },
    { name: 'PORT', value: '8787' }
  ]
});

svc.on('install', () => {
  svc.start();
  console.log('Service installed and started.');
});

svc.install();
