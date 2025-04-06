function main() {
    const piping = require('piping');
    if (!piping()) return;
  
    const electron = require('electron');
    const { spawn } = require('child_process');
  
    const child = spawn(electron, process.argv.slice(2), {
      stdio: 'inherit',
    });
  
    child.on('close', (code) => {
      process.exit(code);
    });
  }
  
  main();
  