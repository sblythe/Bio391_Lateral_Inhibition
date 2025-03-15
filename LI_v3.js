const canvas = document.getElementById("simulationCanvas");
const ctx = canvas.getContext("2d");
const colorbarCanvas = document.getElementById("colorbarCanvas");
const colorbarCtx = colorbarCanvas.getContext("2d");
const hexRadius = 25;
const hill = 3;
const cols = Math.floor(canvas.width / (hexRadius * 1.5));
const rows = Math.floor(canvas.height / (hexRadius * Math.sqrt(3)));
let cells = [];
let alphaN = 2, betaN = 1, alphaD = 2, betaD = 2, gammaD = 5, lambda = 0.2;
let running = false;
const dt = 0.1; // Smaller time step for better gradual updates
let timeStep = 0;

let deltaHistory = [];

const sliders = {
    alphaN: document.getElementById("alphaN"),
    betaN: document.getElementById("betaN"),
    alphaD: document.getElementById("alphaD"),
    betaD: document.getElementById("betaD"),
    gammaD: document.getElementById("gammaD"),
    lambda: document.getElementById("lambda")
};
const labels = {
    alphaN: document.getElementById("alphaNLabel"),
    betaN: document.getElementById("betaNLabel"),
    alphaD: document.getElementById("alphaDLabel"),
    betaD: document.getElementById("betaDLabel"),
    gammaD: document.getElementById("gammaDLabel"),
    lambda: document.getElementById("lambdaLabel")
};
const startButton = document.getElementById("startStopButton");
const resetButton = document.getElementById("resetButton");

function updateSliders() {
    Object.keys(sliders).forEach(key => {
        sliders[key].addEventListener("input", () => {
            window[key] = parseFloat(sliders[key].value);
            labels[key].textContent = sliders[key].value;
        });
    });
}

function createHexGrid() {
    cells = [];
    let boundaryThickness = 1; // Thickness of the inert boundary

    // Calculate total grid size
    let gridWidth = cols * hexRadius * 1.5;
    let gridHeight = rows * hexRadius * Math.sqrt(3);

    // Compute offsets to center the grid
    let xOffset = (canvas.width - gridWidth) / 2;
    let yOffset = (canvas.height - gridHeight) / 2;

    for (let i = -boundaryThickness; i < cols + boundaryThickness; i++) {
        for (let j = -boundaryThickness; j < rows + boundaryThickness; j++) {
            let x = i * hexRadius * 1.5 + xOffset;
            let y = j * hexRadius * Math.sqrt(3) + (i % 2) * hexRadius * Math.sqrt(3) / 2 + yOffset;

            let isBoundary = (i < 0 || i >= cols + 1 || j < 0.5 || j >= rows);

            cells.push({
                x,
                y,
                N: isBoundary ? 1.0 : 1.0 + (Math.random() - 0.5) * 0.2,
                D: isBoundary ? 0.0 : Math.random(),
                isBoundary: isBoundary,
                NotchSignal: 0  // Placeholder, will be updated after grid creation
            });
        }
    }

    for (let i = 0; i < cells.length; i++) {
        if (cells[i].isBoundary) continue;
    
        let neighbors = getNeighbors(i).filter(n => !n.isBoundary);
        let avgDelta = neighbors.length > 0 ? 
            neighbors.reduce((sum, n) => sum + n.D, 0) / neighbors.length : 0;
    
        let safeN = isNaN(cells[i].N) ? 1 : cells[i].N;
        let safeD = isNaN(cells[i].D) ? 0 : cells[i].D;
    
        // Compute initial Notch signaling state
        let NotchSignal = Math.max(0, Math.min(1, (safeN ** hill) * avgDelta - (lambda * safeD)))
        cells[i].NotchSignal = NotchSignal;
    }
    drawCells();
    drawColorbar();
}

function updateCells() {
    let alphaN = window.alphaN;
    let betaN = window.betaN;
    let alphaD = window.alphaD;
    let betaD = window.betaD;
    let gammaD = window.gammaD;
    let lambda = window.lambda;

    for (let i = 0; i < cells.length; i++) {
        let cell = cells[i];
        if (cell.isBoundary) continue; // Skip boundary cells!

        let neighbors = getNeighbors(i).filter(n => !n.isBoundary);
        let avgDelta = neighbors.length > 0 ? 
        neighbors.reduce((sum, n) => sum + n.D, 0) / neighbors.length : 0;
        
        let safeN = isNaN(cell.N) ? 1 : cell.N;  // Default to 1 if NaN
        let safeD = isNaN(cell.D) ? 0 : cell.D;  // Default to 0 if NaN

        let NotchSignal = isNaN((safeN ** hill * avgDelta) - (lambda * safeD)) 
        ? 0 
        : Math.max(0, Math.min(1, (safeN ** hill * avgDelta) - (lambda * safeD)));
        cells[i].NotchSignal = NotchSignal;

        let newD = safeD + dt * (Math.max(0, alphaD) - betaD * safeD - gammaD * NotchSignal + (Math.random() - 0.5) * 0.02);
        let newN = safeN + dt * (alphaN - betaN * safeN);

        cells[i].D = isNaN(newD) ? 0 : Math.max(0, Math.min(1, newD));
        cells[i].N = isNaN(newN) ? 1 : Math.max(0, Math.min(1, newN));
       }
}

function getNeighbors(index) {
    let x = cells[index].x;
    let y = cells[index].y;
    return cells.filter(c => Math.hypot(c.x - x, c.y - y) < hexRadius * 1.75);
}

function drawCells() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    cells.forEach(cell => {
        let color;
        if (cell.isBoundary) {
            color = "grey";  // Boundary hexagons are grey
        } else {
            let notchIntensity = isNaN(cell.NotchSignal) ? 0 : Math.max(0, Math.min(1, cell.NotchSignal));

            // Interpolate between Purple (128, 0, 128) and White (255, 255, 255)
            let red = Math.floor(128 + (255 - 128) * notchIntensity);
            let green = Math.floor(0 + (255 - 0) * notchIntensity);
            let blue = Math.floor(128 + (255 - 128) * notchIntensity);

            color = `rgb(${red}, ${green}, ${blue})`;
        }
        drawHexagon(cell.x, cell.y, color);
    });
}

function drawColorbar() {
    let gradient = colorbarCtx.createLinearGradient(0, 0, 0, colorbarCanvas.height);
    gradient.addColorStop(1, "rgb(128, 0, 128)");  // Low Notch (Purple)
    gradient.addColorStop(0, "rgb(255, 255, 255)");  // High Notch (White)
    
    colorbarCtx.fillStyle = gradient;
    colorbarCtx.fillRect(10, 20, 30, colorbarCanvas.height - 40);

    // Add title
    colorbarCtx.fillStyle = "black";
    colorbarCtx.font = "14px Arial";
    colorbarCtx.fillText("Notch Signaling", 2, 10);
    colorbarCtx.fillText("High", 50, 35);
    colorbarCtx.fillText("Low", 50, colorbarCanvas.height - 20);
}

function drawHexagon(x, y, color) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
        let angle = (Math.PI / 3) * i;
        ctx.lineTo(x + hexRadius * Math.cos(angle), y + hexRadius * Math.sin(angle));
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.stroke();
}

function animate() {
    if (running) {
        console.log("Updating cells...");
        updateCells();
        drawCells();
        requestAnimationFrame(animate);
    }
}

function updateSliders() {
    window.alphaN = parseFloat(sliders.alphaN.value);
    window.betaN = parseFloat(sliders.betaN.value);
    window.alphaD = parseFloat(sliders.alphaD.value);
    window.betaD = parseFloat(sliders.betaD.value);
    window.gammaD = parseFloat(sliders.gammaD.value);
    window.lambda = parseFloat(document.getElementById("lambda").value);

    labels.alphaN.textContent = window.alphaN;
    labels.betaN.textContent = window.betaN;
    labels.alphaD.textContent = window.alphaD;
    labels.betaD.textContent = window.betaD;
    labels.gammaD.textContent = window.gammaD;
    labels.lambda.textContent = window.lambda;

    Object.keys(sliders).forEach(key => {
        sliders[key].addEventListener("input", () => {
            window[key] = parseFloat(sliders[key].value);
            labels[key].textContent = sliders[key].value;
        });
    });

    document.getElementById("lambda").addEventListener("input", () => {
        window.lambda = parseFloat(document.getElementById("lambda").value);
        document.getElementById("lambdaLabel").textContent = window.lambda;
    });

    console.log(`Lambda value: ${window.lambda}`);
}

startButton.addEventListener("click", () => {
    running = !running;
    startButton.textContent = running ? "Stop Simulation" : "Start Simulation";
    if (running) animate();
});

resetButton.addEventListener("click", () => {
    running = false;
    startButton.textContent = "Start Simulation";
    createHexGrid();
});

createHexGrid();
updateSliders();
