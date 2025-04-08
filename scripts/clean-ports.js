const { exec } = require('child_process');

const ports = ['9001', '3002'];
const command = `lsof -i :${ports.join(',:')} -t | xargs kill -9 2>/dev/null || true`;

exec(command, (error, stdout, stderr) => {
  if (error && error.code !== 1) {
    console.error('Error durante la limpieza:', error);
    return;
  }
  console.log('Puertos limpiados correctamente');
});