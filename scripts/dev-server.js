const { spawn } = require('child_process');
const electron = require('electron');

const colors = {
    react: '\x1b[36m',    // Cyan
    server: '\x1b[32m',   // Verde
    electron: '\x1b[35m', // Magenta
    error: '\x1b[31m',    // Rojo
    reset: '\x1b[0m'      // Reset
};

let reactProcess;
let serverProcess;
let electronProcess;

function startProcesses() {
    // Función helper para manejar la salida de los procesos
    const handleOutput = (processName) => (data) => {
        const color = processName.includes('Error') ? colors.error : 
                     processName.includes('React') ? colors.react :
                     processName.includes('Server') ? colors.server : 
                     colors.electron;
        
        console.log(`${color}[${processName}]${colors.reset} ${data.toString().trim()}`);
    };

    // Inicia React
    reactProcess = spawn('yarn', ['react-start'], {
        shell: true,
        env: { ...process.env, BROWSER: 'none' }
    });
    reactProcess.stdout.on('data', handleOutput('React'));
    reactProcess.stderr.on('data', handleOutput('React Error'));

    // Inicia el servidor
    serverProcess = spawn('yarn', ['server-start'], { shell: true });
    serverProcess.stdout.on('data', handleOutput('Server'));
    serverProcess.stderr.on('data', handleOutput('Server Error'));

    // Espera a que React esté listo y luego inicia Electron
    const waitOn = require('wait-on');
    waitOn({ resources: ['http://localhost:3000'] }).then(() => {
        electronProcess = spawn(electron, ['.'], { shell: true });
        electronProcess.stdout.on('data', handleOutput('Electron'));
        electronProcess.stderr.on('data', handleOutput('Electron Error'));

        electronProcess.on('close', () => {
            console.log('[Dev] Electron closed - cleaning up...');
            reactProcess.kill();
            serverProcess.kill();
            process.exit(0);
        });
    });
}

// Manejo de señales de terminación
process.on('SIGTERM', () => {
    console.log('[Dev] Received SIGTERM - cleaning up...');
    if (reactProcess) reactProcess.kill();
    if (serverProcess) reactProcess.kill();
    if (electronProcess) reactProcess.kill();
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('[Dev] Received SIGINT - cleaning up...');
    if (reactProcess) reactProcess.kill();
    if (serverProcess) reactProcess.kill();
    if (electronProcess) reactProcess.kill();
    process.exit(0);
});

console.log('[Dev] Starting development environment...');
startProcesses();