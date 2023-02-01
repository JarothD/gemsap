const wss = new WebSocket("ws://localhost:3002")

wss.onopen = () => {
    console.log("Conexión Establecida")
  }

wss.onclose = function() {
  console.log('WebSocket connection closed');
};

window.addEventListener('beforeunload', function() {
  wss.close();
});

export default wss;