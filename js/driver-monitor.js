window.DriverMonitor = {
  isActive: false,
  videoEl: null,
  canvasEl: null,
  stream: null,
  detectorOptions: null,
  detectionInterval: null,
  bpmInterval: null,
  faceLostTime: 0,
  
  async start() {
    this.isActive = true;
    document.getElementById('driver-monitoring-overlay').classList.remove('hidden');
    
    // Check if models are loaded
    if (!faceapi.nets.tinyFaceDetector.isLoaded) {
      await faceapi.nets.tinyFaceDetector.loadFromUri('models');
    }
    
    this.detectorOptions = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 });
    this.videoEl = document.getElementById('monitor-video');
    this.canvasEl = document.getElementById('monitor-canvas');
    
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      this.videoEl.srcObject = this.stream;
    } catch (err) {
      alert('Erro ao acessar a câmera: ' + err.message);
      this.stop();
      return;
    }
    
    this.videoEl.addEventListener('play', () => this.onPlay());
    this.startBpmSimulation();
    
    if (window.lucide) lucide.createIcons();
  },
  
  stop() {
    this.isActive = false;
    const overlay = document.getElementById('driver-monitoring-overlay');
    if (overlay) overlay.classList.add('hidden');
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
    }
    clearInterval(this.detectionInterval);
    clearInterval(this.bpmInterval);
  },
  
  async onPlay() {
    if (!this.isActive) return;
    
    const displaySize = { width: this.videoEl.videoWidth, height: this.videoEl.videoHeight };
    faceapi.matchDimensions(this.canvasEl, displaySize);
    
    this.detectionInterval = setInterval(async () => {
      if (!this.isActive) return;
      
      const detection = await faceapi.detectSingleFace(this.videoEl, this.detectorOptions);
      const ctx = this.canvasEl.getContext('2d');
      ctx.clearRect(0, 0, this.canvasEl.width, this.canvasEl.height);
      
      if (detection) {
        this.faceLostTime = 0;
        document.getElementById('monitor-warning').classList.add('hidden');
        document.getElementById('monitor-shield-icon').classList.replace('text-rose-500', 'text-emerald-500');
        document.getElementById('monitor-status-text').textContent = 'Rosto Detectado';
        document.getElementById('monitor-status-text').classList.replace('text-rose-400', 'text-emerald-400');
        
        const resizedDetections = faceapi.resizeResults(detection, displaySize);
        faceapi.draw.drawDetections(this.canvasEl, resizedDetections);
      } else {
        this.faceLostTime += 500;
        if (this.faceLostTime > 3000) {
          document.getElementById('monitor-warning').classList.remove('hidden');
          document.getElementById('monitor-shield-icon').classList.replace('text-emerald-500', 'text-rose-500');
          document.getElementById('monitor-status-text').textContent = 'Atenção! Sem Foco';
          document.getElementById('monitor-status-text').classList.replace('text-emerald-400', 'text-rose-400');
          this.playBeep();
        }
      }
    }, 500);
  },
  
  startBpmSimulation() {
    let currentBpm = 72;
    document.getElementById('bpm-value').textContent = currentBpm;
    
    this.bpmInterval = setInterval(() => {
      let change = Math.floor(Math.random() * 5) - 2;
      currentBpm += change;
      if (currentBpm < 65) currentBpm = 65;
      if (currentBpm > 85) currentBpm = 85;
      document.getElementById('bpm-value').textContent = currentBpm;
    }, 2000);
  },
  
  playBeep() {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    const oscillator = this.audioCtx.createOscillator();
    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(800, this.audioCtx.currentTime);
    oscillator.connect(this.audioCtx.destination);
    oscillator.start();
    setTimeout(() => oscillator.stop(), 200);
  }
};
