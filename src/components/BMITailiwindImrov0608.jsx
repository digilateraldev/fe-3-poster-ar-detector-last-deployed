import React, { useRef, useEffect, useState } from 'react';
import { Hands } from '@mediapipe/hands';

const BMISelectionAppTailwind2 = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [detectionStatus, setDetectionStatus] = useState('Initializing...');
  const [fingerPosition, setFingerPosition] = useState(null);
  const handsRef = useRef(null);
  const animationRef = useRef(null);
  const frameCounterRef = useRef(0);

  const startCamera = async () => {
    try {
      setDetectionStatus('Accessing camera...');
      let stream;
      
      // Try all camera options with better error handling
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 }
          } 
        });
      } catch (err) {
        console.log('Environment camera failed, trying user camera');
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: 'user',
            width: { ideal: 1280 },
            height: { ideal: 720 }
          } 
        });
      }
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(e => console.error('Video play error:', e));
      }
      
      return new Promise((resolve) => {
        if (videoRef.current) {
          videoRef.current.onloadedmetadata = () => {
            setDetectionStatus('Camera ready - show your hand');
            resolve(videoRef.current);
          };
          videoRef.current.onerror = () => {
            setDetectionStatus('Camera error');
            console.error('Video error');
          };
        }
      });
    } catch (error) {
      console.error('Camera Error:', error);
      setDetectionStatus('Camera access denied or not available');
      return null;
    }
  };

  useEffect(() => {
    const initialize = async () => {
      await startCamera();
      
      if (!videoRef.current || !canvasRef.current) {
        setDetectionStatus('Video or canvas not available');
        return;
      }

      const hands = new Hands({
        locateFile: (file) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
        }
      });

      hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.5, // Lowered from 0.7
        minTrackingConfidence: 0.5   // Lowered from 0.7
      });

      hands.onResults((results) => {
        processHandResults(results);
      });

      handsRef.current = hands;

      // Slower detection loop (process every 3rd frame)
      const detectLoop = () => {
        frameCounterRef.current += 1;
        if (frameCounterRef.current % 3 === 0 && videoRef.current && handsRef.current) {
          try {
            handsRef.current.send({ image: videoRef.current });
          } catch (e) {
            console.error('Detection error:', e);
          }
        }
        animationRef.current = requestAnimationFrame(detectLoop);
      };
      detectLoop();

      return () => {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
        if (handsRef.current) {
          handsRef.current.close();
        }
        if (videoRef.current && videoRef.current.srcObject) {
          videoRef.current.srcObject.getTracks().forEach(track => track.stop());
        }
      };
    };

    initialize();

  }, []);

  const processHandResults = (results) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw the video frame first for debugging
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Draw the hand landmarks
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      const landmarks = results.multiHandLandmarks[0];
      
      // Index finger landmarks
      const indexFingerTip = landmarks[8];
      
      if (indexFingerTip) {
        // Convert normalized coordinates to pixel values
        const x = indexFingerTip.x * canvas.width;
        const y = indexFingerTip.y * canvas.height;
        
        // Store finger position
        setFingerPosition({ x, y });
        setDetectionStatus('Finger detected!');

        // Draw all landmarks for debugging
        for (const landmark of landmarks) {
          ctx.fillStyle = '#FF0000';
          ctx.beginPath();
          ctx.arc(
            landmark.x * canvas.width,
            landmark.y * canvas.height,
            3, 0, 2 * Math.PI
          );
          ctx.fill();
        }

        // Draw 4cm radius circle (approximate)
        const radiusPixels = (4 / 2.54) * 96; // 4cm to pixels
        ctx.strokeStyle = 'rgba(0, 200, 255, 0.7)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, radiusPixels, 0, 2 * Math.PI);
        ctx.stroke();

      } else {
        setDetectionStatus('Hand detected but no finger');
        setFingerPosition(null);
      }
    } else {
      setDetectionStatus('Move your hand into view');
      setFingerPosition(null);
    }
  };

  return (
    <div className="relative w-full max-w-2xl mx-auto">
      <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
        <video
          ref={videoRef}
          className="w-full h-full object-cover transform scaleX(-1)" // Mirror the video
          playsInline
          autoPlay
          muted
        />
        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0 w-full h-full pointer-events-none"
        />
      </div>
      
      <div className="mt-4 p-4 bg-gray-800 text-white rounded-lg">
        <div className="flex justify-between items-center">
          <span className="font-medium">Status:</span>
          <span className={`font-bold ${
            detectionStatus.includes('detected') ? 'text-green-400' : 
            detectionStatus.includes('ready') ? 'text-blue-400' : 'text-yellow-400'
          }`}>
            {detectionStatus}
          </span>
        </div>
        
        {fingerPosition && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div className="bg-gray-700 p-2 rounded">
              <span className="text-gray-400">X:</span> {fingerPosition.x.toFixed(0)}px
            </div>
            <div className="bg-gray-700 p-2 rounded">
              <span className="text-gray-400">Y:</span> {fingerPosition.y.toFixed(0)}px
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BMISelectionAppTailwind2;



// BMISelectionAppTailwind2