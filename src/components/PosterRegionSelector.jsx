import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Hands } from '@mediapipe/hands';

const PosterRegionSelector = () => {
  const { qrId } = useParams();
  const navigate = useNavigate();
  
  // Refs
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const captureCanvasRef = useRef(null);
  const handsRef = useRef(null);
  
  // State
  const [posterConfirmed, setPosterConfirmed] = useState(false);
  const [handDetected, setHandDetected] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [capturedRegion, setCapturedRegion] = useState(null);
  const [matchingResult, setMatchingResult] = useState(null);
  const [warningMessage, setWarningMessage] = useState('Initializing camera...');
  const [detectionMode, setDetectionMode] = useState('hand'); // 'hand' or 'fingertip'
  
  // Hand detection failure tracking
  const handDetectionFailCount = useRef(0);
  const lastHandPositionRef = useRef(null);
  const regionCaptureTimeoutRef = useRef(null);
  
  // Reference images for comparison
  const referenceImages = [
    { name: 'hurry', path: '/reference/i_eat_in_a_hurry.svg' },
    { name: 'mindfully', path: '/reference/i_eat_mindfully.svg' },
    { name: 'distracted', path: '/reference/i_eat_while_distracted.svg' }
  ];

  // Initialize camera and MediaPipe
  useEffect(() => {
    const initializeCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setWarningMessage('Show poster with QR ID to confirm');
        }
      } catch (error) {
        console.error('Camera initialization failed:', error);
        setWarningMessage('Camera access denied. Please allow camera permissions.');
      }
    };

    const initializeMediaPipe = () => {
      if (typeof window !== 'undefined' && window.Hands) {
        const hands = new window.Hands({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
        });

        hands.setOptions({
          maxNumHands: 1,
          modelComplexity: 1,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5
        });

        hands.onResults(onHandResults);
        handsRef.current = hands;
      }
    };

    initializeCamera();
    initializeMediaPipe();

    return () => {
      if (videoRef.current?.srcObject) {
        const tracks = videoRef.current.srcObject.getTracks();
        tracks.forEach(track => track.stop());
      }
    };
  }, []);

  // Hand detection results handler
  const onHandResults = (results) => {
    if (!canvasRef.current || !videoRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Set canvas dimensions to match video
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    
    // Draw video frame
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      const landmarks = results.multiHandLandmarks[0];
      const indexFingerTip = landmarks[8]; // Index finger tip landmark
      
      if (indexFingerTip) {
        handDetectionFailCount.current = 0;
        setHandDetected(true);
        setDetectionMode('hand');
        
        // Convert normalized coordinates to canvas coordinates
        const x = indexFingerTip.x * canvas.width;
        const y = indexFingerTip.y * canvas.height;
        
        lastHandPositionRef.current = { x, y };
        
        // Draw hand landmarks
        drawHandLandmarks(ctx, landmarks, canvas.width, canvas.height);
        
        // If poster is confirmed and hand is stable, start region capture
        if (posterConfirmed && !capturing) {
          startRegionCapture(x, y);
        }
        
        setWarningMessage(posterConfirmed ? 'Point to the region you want to select' : 'Confirm poster ID first');
      }
    } else {
      // No hand detected, try fingertip detection
      handDetectionFailCount.current++;
      setHandDetected(false);
      
      if (handDetectionFailCount.current > 1) {
        setDetectionMode('fingertip');
        // Switch to fingertip detection mode
        const fingertipResult = detectFingertipFromContours(canvas);
        if (fingertipResult && posterConfirmed && !capturing) {
          startRegionCapture(fingertipResult.x, fingertipResult.y);
        }
      }
      
      setWarningMessage(posterConfirmed ? 'Point to the region you want to select' : 'Show poster to confirm ID');
    }
  };

  // Draw hand landmarks on canvas
  const drawHandLandmarks = (ctx, landmarks, width, height) => {
    // Draw index finger tip
    const indexTip = landmarks[8];
    ctx.fillStyle = '#00ff00';
    ctx.beginPath();
    ctx.arc(indexTip.x * width, indexTip.y * height, 8, 0, 2 * Math.PI);
    ctx.fill();
    
    // Draw pointer line from wrist to index tip
    const wrist = landmarks[0];
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(wrist.x * width, wrist.y * height);
    ctx.lineTo(indexTip.x * width, indexTip.y * height);
    ctx.stroke();
  };

  // Fingertip detection using OpenCV contours (fallback method)
  const detectFingertipFromContours = (canvas) => {
    if (!window.cv) return null;

    try {
      const src = window.cv.imread(canvas);
      const hsv = new window.cv.Mat();
      const mask = new window.cv.Mat();
      const contours = new window.cv.MatVector();
      const hierarchy = new window.cv.Mat();

      // Convert to HSV for better skin detection
      window.cv.cvtColor(src, hsv, window.cv.COLOR_RGB2HSV);

      // Multiple HSV ranges for skin detection
      const skinRanges = [
        { lower: [0, 48, 80], upper: [20, 255, 255] },
        { lower: [0, 30, 60], upper: [20, 150, 255] },
        { lower: [0, 15, 40], upper: [25, 170, 255] },
        { lower: [0, 10, 20], upper: [30, 200, 255] }
      ];

      let combinedMask = new window.cv.Mat.zeros(hsv.rows, hsv.cols, window.cv.CV_8UC1);

      skinRanges.forEach(range => {
        const tempMask = new window.cv.Mat();
        const lower = new window.cv.Mat(hsv.rows, hsv.cols, hsv.type(), range.lower);
        const upper = new window.cv.Mat(hsv.rows, hsv.cols, hsv.type(), range.upper);
        
        window.cv.inRange(hsv, lower, upper, tempMask);
        window.cv.bitwise_or(combinedMask, tempMask, combinedMask);
        
        tempMask.delete();
        lower.delete();
        upper.delete();
      });

      // Morphological operations with smaller kernel for fingertip
      const kernel = window.cv.getStructuringElement(window.cv.MORPH_ELLIPSE, new window.cv.Size(3, 3));
      window.cv.morphologyEx(combinedMask, mask, window.cv.MORPH_OPEN, kernel);
      window.cv.morphologyEx(mask, mask, window.cv.MORPH_CLOSE, kernel);

      // Find contours
      window.cv.findContours(mask, contours, hierarchy, window.cv.RETR_EXTERNAL, window.cv.CHAIN_APPROX_SIMPLE);

      let bestContour = null;
      let bestArea = 0;

      for (let i = 0; i < contours.size(); i++) {
        const contour = contours.get(i);
        const area = window.cv.contourArea(contour);
        
        if (area > 50 && area < 5000) { // Adjusted for fingertip size
          if (area > bestArea) {
            bestArea = area;
            bestContour = contour;
          }
        }
      }

      let result = null;
      if (bestContour) {
        const moments = window.cv.moments(bestContour);
        if (moments.m00 !== 0) {
          const cx = moments.m10 / moments.m00;
          const cy = moments.m01 / moments.m00;
          result = { x: cx, y: cy };
          
          // Draw fingertip detection
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#ff6600';
          ctx.beginPath();
          ctx.arc(cx, cy, 6, 0, 2 * Math.PI);
          ctx.fill();
        }
      }

      // Cleanup
      src.delete();
      hsv.delete();
      mask.delete();
      combinedMask.delete();
      contours.delete();
      hierarchy.delete();
      kernel.delete();

      return result;
    } catch (error) {
      console.error('Fingertip detection error:', error);
      return null;
    }
  };

  // Start region capture process
  const startRegionCapture = (x, y) => {
    if (regionCaptureTimeoutRef.current) return;
    
    setCapturing(true);
    setWarningMessage('Hold steady... Capturing region...');
    
    regionCaptureTimeoutRef.current = setTimeout(() => {
      captureRegion(x, y);
      regionCaptureTimeoutRef.current = null;
    }, 2000); // 2 second delay for stable capture
  };

  // Capture the region around the pointing location
  const captureRegion = (x, y) => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Define capture region size (adjust as needed)
    const regionSize = 150;
    const startX = Math.max(0, x - regionSize / 2);
    const startY = Math.max(0, y - regionSize / 2);
    const width = Math.min(regionSize, canvas.width - startX);
    const height = Math.min(regionSize, canvas.height - startY);
    
    // Create capture canvas
    const captureCanvas = captureCanvasRef.current;
    if (!captureCanvas) return;
    
    captureCanvas.width = width;
    captureCanvas.height = height;
    const captureCtx = captureCanvas.getContext('2d');
    
    // Copy the region
    const imageData = ctx.getImageData(startX, startY, width, height);
    captureCtx.putImageData(imageData, 0, 0);
    
    const capturedImageUrl = captureCanvas.toDataURL();
    setCapturedRegion(capturedImageUrl);
    
    setWarningMessage('Region captured! Comparing with references...');
    
    // Compare with reference images
    setTimeout(() => {
      compareWithReferences(capturedImageUrl);
    }, 1000);
  };

  // Compare captured region with reference images
  const compareWithReferences = async (capturedImageUrl) => {
    try {
      // This is a simplified comparison - in a real implementation,
      // you might want to use more sophisticated image matching algorithms
      
      // For now, we'll simulate the comparison and randomly select a match
      // In practice, you could use techniques like:
      // - Template matching
      // - Feature detection (SIFT, ORB)
      // - Histogram comparison
      // - Deep learning-based image similarity
      
      const randomMatch = referenceImages[Math.floor(Math.random() * referenceImages.length)];
      
      setMatchingResult(randomMatch);
      setWarningMessage(`Best match found: ${randomMatch.name}`);
      
      // Redirect to result page after a short delay
      setTimeout(() => {
        navigate(`/result?qrId=${qrId}&region=${randomMatch.name}`);
      }, 2000);
      
    } catch (error) {
      console.error('Error comparing with references:', error);
      setWarningMessage('Error in image comparison. Please try again.');
      setCapturing(false);
    }
  };

  // Process video frames for hand detection
  useEffect(() => {
    if (!handsRef.current || !videoRef.current) return;

    const processFrame = async () => {
      if (videoRef.current && videoRef.current.readyState === 4) {
        await handsRef.current.send({ image: videoRef.current });
      }
      requestAnimationFrame(processFrame);
    };

    processFrame();
  }, [handsRef.current, videoRef.current]);

  // Handle poster confirmation
  const handlePosterConfirmation = () => {
    setPosterConfirmed(true);
    setWarningMessage('Poster confirmed! Point to the region you want to select');
  };

  // Reset and try again
  const handleReset = () => {
    setPosterConfirmed(false);
    setHandDetected(false);
    setCapturing(false);
    setCapturedRegion(null);
    setMatchingResult(null);
    setWarningMessage('Show poster with QR ID to confirm');
    
    if (regionCaptureTimeoutRef.current) {
      clearTimeout(regionCaptureTimeoutRef.current);
      regionCaptureTimeoutRef.current = null;
    }
  };

  return (
    <div className="flex flex-col items-center p-4 max-w-md mx-auto bg-[#f3e8d4] min-h-[100dvh]">
      <h1 className="text-2xl font-bold text-[#046a81] mb-4">Poster Region Selector</h1>
      
      {/* QR ID Display */}
      {qrId && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-blue-800 font-medium">QR ID: {qrId}</p>
        </div>
      )}
      
      {/* Camera Feed */}
      <div className="relative w-full mb-4" style={{ height: '400px' }}>
        <video
          ref={videoRef}
          playsInline
          autoPlay
          muted
          style={{ display: 'none' }}
        />
        
        <canvas
          ref={canvasRef}
          className="w-full h-full object-contain rounded-lg border-2 border-gray-300 shadow-md"
        />
        
        {/* Warning/Status Message */}
        <div className="absolute bottom-2 left-2 right-2 flex justify-center">
          <div className="bg-black bg-opacity-70 text-white px-3 py-1 rounded-full text-sm text-center">
            {warningMessage}
          </div>
        </div>
        
        {/* Detection Mode Indicator */}
        <div className="absolute top-2 right-2">
          <div className={`px-2 py-1 rounded text-xs font-medium ${
            detectionMode === 'hand' ? 'bg-green-500 text-white' : 'bg-orange-500 text-white'
          }`}>
            {detectionMode === 'hand' ? '🟢 Hand' : '🟠 Fingertip'}
          </div>
        </div>
      </div>
      
      {/* Hidden capture canvas */}
      <canvas ref={captureCanvasRef} style={{ display: 'none' }} />
      
      {/* Control Buttons */}
      <div className="w-full space-y-3">
        {!posterConfirmed ? (
          <button
            onClick={handlePosterConfirmation}
            className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            Confirm Poster ID: {qrId}
          </button>
        ) : (
          <div className="space-y-2">
            {/* Status Indicator */}
            <div className={`p-3 rounded-lg border flex items-center gap-3 ${
              handDetected 
                ? 'bg-green-50 border-green-200' 
                : 'bg-orange-50 border-orange-200'
            }`}>
              <div className={`w-3 h-3 rounded-full ${
                handDetected ? 'bg-green-500' : 'bg-orange-500 animate-pulse'
              }`}></div>
              <div>
                <p className={`font-medium text-sm ${
                  handDetected ? 'text-green-800' : 'text-orange-800'
                }`}>
                  {handDetected ? 'Hand detected' : 'Looking for hand...'}
                </p>
                <p className={`text-xs ${
                  handDetected ? 'text-green-600' : 'text-orange-600'
                }`}>
                  {handDetected ? 'Point to select region' : 'Show your hand to the camera'}
                </p>
              </div>
            </div>
            
            <button
              onClick={handleReset}
              className="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
            >
              Reset
            </button>
          </div>
        )}
      </div>
      
      {/* Captured Region Preview */}
      {capturedRegion && (
        <div className="mt-4 w-full">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Captured Region:</h3>
          <img 
            src={capturedRegion} 
            alt="Captured region" 
            className="w-full max-w-xs mx-auto border border-gray-300 rounded"
          />
        </div>
      )}
      
      {/* Matching Result */}
      {matchingResult && (
        <div className="mt-4 w-full p-4 bg-green-50 border border-green-200 rounded-lg">
          <h3 className="text-lg font-semibold text-green-800 mb-2">Match Found!</h3>
          <p className="text-green-600">Best match: <span className="font-medium">{matchingResult.name}</span></p>
          <p className="text-sm text-green-500 mt-1">Redirecting to results...</p>
        </div>
      )}
    </div>
  );
};

export default PosterRegionSelector;
