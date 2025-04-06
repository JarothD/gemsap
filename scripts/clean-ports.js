const { exec } = require('child_process');

function killProcess(port) {
    return new Promise((resolve, reject) => {
        const command = `netstat -ano | findstr :${port}`;
        
        exec(command, (error, stdout, stderr) => {
            if (error) {
                // Si no hay proceso en el puerto, consideramos exitoso
                if (error.code === 1) {
                    console.log(`No hay proceso en el puerto ${port}`);
                    resolve();
                    return;
                }
                reject(error);
                return;
            }

            const lines = stdout.split('\n');
            for (const line of lines) {
                const parts = line.trim().split(/\s+/);
                if (parts.length > 4) {
                    const pid = parts[parts.length - 1];
                    if (pid) {
                        exec(`taskkill /F /PID ${pid}`, (err) => {
                            if (err) {
                                console.log(`No se pudo cerrar el proceso en puerto ${port}`);
                            } else {
                                console.log(`Proceso en puerto ${port} cerrado (PID: ${pid})`);
                            }
                        });
                    }
                }
            }
            resolve();
        });
    });
}

async function cleanPorts() {
    try {
        await Promise.all([
            killProcess(9001),
            killProcess(3002)
        ]);
        console.log('Limpieza de puertos completada');
    } catch (error) {
        console.error('Error durante la limpieza:', error);
        process.exit(1);
    }
}

cleanPorts();