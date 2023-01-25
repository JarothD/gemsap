const { exec } = require("child_process")

window.addEventListener("DOMContentLoaded", () => {
    exec(`npm run cors-server`)
})