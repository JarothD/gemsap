const ws = require('ws');
const wsServer = new ws.Server({port: '3002'});

global.send = null;

wsServer.on('connection', socket => {
    console.log("Conecction Established")   

    global.send = (data) => {
        socket.send(data, (error) => {
            if(error) console.error(error)
        })
    }

    socket.on('error', (error) => {
        console.error(error);
    });

    socket.on('close', (ws) => {
        console.log('Connection closed')
    })
    
})

module.exports = {
    send: send
}