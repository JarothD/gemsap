const { execSync } = require('child_process');

function cleanPorts() {
  const ports = [3002, 9001];
  const isWindows = process.platform === 'win32';

  try {
    for (const port of ports) {
      if (isWindows) {
        try {
          // Find process on port
          const findCommand = `netstat -ano | findstr :${port}`;
          const result = execSync(findCommand, { encoding: 'utf8' });
          
          if (result) {
            // Extract PID and kill it
            const pid = result.split(/\s+/)[5];
            if (pid) {
              try {
                execSync(`taskkill /F /PID ${pid}`);
                console.log(`Successfully killed process on port ${port} (PID: ${pid})`);
              } catch (err) {
                // Process might already be gone
                console.log(`No active process found on port ${port}`);
              }
            }
          }
        } catch (err) {
          // Port might not be in use
          console.log(`No process found using port ${port}`);
        }
      } else {
        // Linux/Mac command
        try {
          execSync(`lsof -ti:${port} | xargs kill -9`);
          console.log(`Successfully killed process on port ${port}`);
        } catch (err) {
          console.log(`No process found using port ${port}`);
        }
      }
    }
  } catch (error) {
    console.error('Error during port cleanup:', error.message);
    // Exit with success even if there's an error
    process.exit(0);
  }
}

cleanPorts();