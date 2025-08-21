import React, { useEffect, useRef, useState } from "react";
import { Hands } from "@mediapipe/hands";

const SimplePosterSelector = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const pointerRef = useRef(null);
  const containerRef = useRef(null);
  const detectionCanvasRef = useRef(null);

  const [warningMessage, setWarningMessage] = useState("Initializing...");
  const [detectionMode, setDetectionMode] = useState("hand");
  const [isDetected, setIsDetected] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handDetectionFailCount = useRef(0);
  const handsRef = useRef(null);

  const detectFingertipFromContours = (imageData, width, height) => {
    try {
      const canvas = detectionCanvasRef.current;
      if (!canvas) return null;

      const ctx = canvas.getContext("2d");
      canvas.width = width;
      canvas.height = height;
      ctx.putImageData(imageData, 0, 0);

      // Convert to OpenCV Mat
      let src = window.cv.matFromImageData(imageData);
      let hsv = new window.cv.Mat();
      let mask = new window.cv.Mat();
      let kernel = window.cv.getStructuringElement(
        window.cv.MORPH_ELLIPSE,
        new window.cv.Size(5, 5)
      );

      // Convert to HSV and threshold skin color
      window.cv.cvtColor(src, src, window.cv.COLOR_RGBA2RGB);
      window.cv.cvtColor(src, hsv, window.cv.COLOR_RGB2HSV);

      // Skin color ranges (expanded for better detection)
      let lower1 = new window.cv.Mat(hsv.rows, hsv.cols, hsv.type(), [0, 15, 50, 0]);
      let upper1 = new window.cv.Mat(hsv.rows, hsv.cols, hsv.type(), [25, 255, 255, 255]);
      let mask1 = new window.cv.Mat();
      window.cv.inRange(hsv, lower1, upper1, mask1);

      // Reddish skin tones
      let lower2 = new window.cv.Mat(hsv.rows, hsv.cols, hsv.type(), [160, 15, 50, 0]);
      let upper2 = new window.cv.Mat(hsv.rows, hsv.cols, hsv.type(), [180, 255, 255, 255]);
      let mask2 = new window.cv.Mat();
      window.cv.inRange(hsv, lower2, upper2, mask2);

      // Combine masks
      let tempMask = new window.cv.Mat();
      window.cv.add(mask1, mask2, tempMask);
      window.cv.add(tempMask, mask3, mask);

      // Morphological operations
      window.cv.morphologyEx(
        mask,
        mask,
        window.cv.MORPH_CLOSE,
        kernel,
        new window.cv.Point(-1, -1),
        2
      );
      window.cv.morphologyEx(
        mask,
        mask,
        window.cv.MORPH_OPEN,
        kernel,
        new window.cv.Point(-1, -1),
        2
      );

      // Find contours
      let contours = new window.cv.MatVector();
      let hierarchy = new window.cv.Mat();
      window.cv.findContours(
        mask,
        contours,
        hierarchy,
        window.cv.RETR_EXTERNAL,
        window.cv.CHAIN_APPROX_SIMPLE
      );

      // Find the best contour (largest area)
      let bestContour = null;
      let maxArea = 0;
      for (let i = 0; i < contours.size(); i++) {
        const cnt = contours.get(i);
        const area = window.cv.contourArea(cnt);
        if (area > maxArea) {
          maxArea = area;
          bestContour = cnt;
        }
      }

      let point = null;
      if (bestContour) {
        // Find topmost point of best contour
        let topmost = null;
        let minY = Infinity;
        for (let i = 0; i < bestContour.total(); i++) {
          let x = bestContour.intPtr(i)[0];
          let y = bestContour.intPtr(i)[1];
          if (y < minY) {
            minY = y;
            topmost = { x, y };
          }
        }
        point = topmost;
      }

      // Clean up
      src.delete();
      hsv.delete();
      mask.delete();
      kernel.delete();
      contours.delete();
      hierarchy.delete();
      lower1.delete();
      upper1.delete();
      lower2.delete();
      upper2.delete();
      mask1.delete();
      mask2.delete();
      tempMask.delete();

      return point;
    } catch (error) {
      console.error("Fingertip detection error:", error);
      return null;
    }
  };

  useEffect(() => {
    const startCamera = async () => {
      let stream = null;
      let constraints = { video: { facingMode: { exact: "environment" } } };

      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err) {
        constraints.video.facingMode = { ideal: "environment" };
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (err2) {
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
        }
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      return new Promise((resolve) => {
        videoRef.current.onloadedmetadata = () => {
          resolve(videoRef.current);
        };
      });
    };

    startCamera().then(() => {
      const hands = new Hands({
        locateFile: (file) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
      });

      hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 0,
        minDetectionConfidence: 0.3,
        minTrackingConfidence: 0.3,
      });

      handsRef.current = hands;

      hands.onResults((results) => {
        let fingerTip = null;

        // Hide pointer initially
        if (pointerRef.current) {
          pointerRef.current.style.display = "none";
        }

        // Try MediaPipe hand detection first
        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
          const indexTip = results.multiHandLandmarks[0][8];
          const canvas = canvasRef.current;
          if (canvas) {
            fingerTip = {
              x: indexTip.x * canvas.width,
              y: indexTip.y * canvas.height,
            };
            handDetectionFailCount.current = 0;
            setDetectionMode("hand");
            setWarningMessage("Hand detected");
            setIsDetected(true);
          }
        } else {
          handDetectionFailCount.current++;
          setWarningMessage(
            `Trying fallback detection (${handDetectionFailCount.current}/4)`
          );
          setIsDetected(false);

          // Fall back to contour detection if hand detection fails
          if (handDetectionFailCount.current > 2) {
            setDetectionMode("fingertip");

            const canvas = canvasRef.current;
            const video = videoRef.current;
            if (canvas && video) {
              const ctx = canvas.getContext("2d");
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

              try {
                const imageData = ctx.getImageData(
                  0,
                  0,
                  canvas.width,
                  canvas.height
                );
                const detectedTip = detectFingertipFromContours(
                  imageData,
                  canvas.width,
                  canvas.height
                );

                if (detectedTip) {
                  // Boundary check
                  if (
                    detectedTip.x > 10 &&
                    detectedTip.y > 10 &&
                    detectedTip.x < canvas.width - 10 &&
                    detectedTip.y < canvas.height - 10
                  ) {
                    fingerTip = detectedTip;
                    setWarningMessage("Fingertip detected");
                    setIsDetected(true);
                  }
                } else {
                  setWarningMessage("No fingertip detected");
                  setIsDetected(false);
                }
              } catch (error) {
                console.error("Error in fingertip detection:", error);
                setWarningMessage("Detection error");
                setIsDetected(false);
              }
            }
          }
        }

        // Show pointer if finger/hand detected
        if (fingerTip) {
          requestAnimationFrame(() => {
            if (pointerRef.current) {
              pointerRef.current.style.display = "block";
              pointerRef.current.style.left = `${fingerTip.x}px`;
              pointerRef.current.style.top = `${fingerTip.y}px`;
            }
          });
        }
      });

      const detectLoop = async () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas) return;

        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        await handsRef.current.send({ image: video });
        requestAnimationFrame(detectLoop);
      };

      const scaleContainer = () => {
        const wrapper = containerRef.current?.parentElement;
        if (!wrapper || !containerRef.current) return;

        const scaleX = wrapper.clientWidth / wrapper.clientHeight;
        const scaleY = 1;
        containerRef.current.style.transform = `scale(${scaleX}, ${scaleY})`;
      };

      scaleContainer();
      window.addEventListener("resize", scaleContainer);
      detectLoop();
    });

    return () => {
      if (handsRef.current) {
        handsRef.current.close();
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center p-4 bg-[#f3e8d4] h-[100dvh]">
      <h1 className="text-2xl font-bold text-[#046a81] mb-4">Hand Detection</h1>

      <div
        className="wrapper relative bg-black overflow-hidden rounded-lg"
        style={{
          width: "100vw",
          height: "75vh",
          maxHeight: "75vh",
          maxWidth: "100vw",
        }}
      >
        <div
          id="container"
          ref={containerRef}
          className="absolute inset-0"
          style={{
            width: "100%",
            height: "100%",
            transformOrigin: "top left",
          }}
        >
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />

          <canvas
            ref={canvasRef}
            className="absolute inset-0 hidden"
          />

          <canvas ref={detectionCanvasRef} className="hidden" />

          <div
            ref={pointerRef}
            className={`absolute w-8 h-8 rounded-full border-2 border-white pointer-events-none hidden transform -translate-x-1/2 -translate-y-1/2 ${
              detectionMode === "hand" ? "bg-green-500" : "bg-orange-500"
            } bg-opacity-70`}
          />
        </div>
      </div>

      <div className="mt-4 w-full">
        {isDetected ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-3">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <div>
              <p className="text-green-800 font-medium text-sm">
                {detectionMode === "hand" ? "Hand detected" : "Fingertip detected"}
              </p>
              <p className="text-green-600 text-xs">
                Current mode: {detectionMode}
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 flex items-center gap-3">
            <div className="w-3 h-3 bg-orange-500 rounded-full animate-pulse"></div>
            <div>
              <p className="text-orange-800 font-medium text-sm">
                {warningMessage}
              </p>
              <p className="text-orange-600 text-xs">
                Show your hand or finger to the camera
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 w-full max-w-md">
        <button
          onClick={() => setIsProcessing(!isProcessing)}
          disabled={!isDetected}
          className={`w-full py-3 px-4 rounded-lg font-medium text-white transition-colors ${
            isDetected
              ? "bg-blue-600 hover:bg-blue-700"
              : "bg-gray-400 cursor-not-allowed"
          }`}
        >
          {isProcessing ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Processing...
            </span>
          ) : (
            "Capture Detection"
          )}
        </button>
      </div>
    </div>
  );
};

export default SimplePosterSelector;


// import React, { useEffect, useRef, useState } from 'react';
// import { useParams, useNavigate } from 'react-router-dom';

// const SimplePosterSelector = () => {
//   const { qrId } = useParams();
//   const navigate = useNavigate();
  
//   // Refs
//   const videoRef = useRef(null);
//   const canvasRef = useRef(null);
//   const referenceCanvasRef = useRef([]);
  
//   // State
//   // Add this to your state declarations
// const [debugInfo, setDebugInfo] = useState({
//     openCVLoaded: false,
//     pointing: false,
//     error: null,
//     matchResults: null,
//     handArea: null
//   });
  
//   const [posterVerified, setPosterVerified] = useState(false);
//   const [handDetected, setHandDetected] = useState(false);
//   const [capturing, setCapturing] = useState(false);
//   const [warningMessage, setWarningMessage] = useState('Initializing...');
//   const [mode, setMode] = useState('verify-poster');
//   const [referenceImages, setReferenceImages] = useState([
//     { name: 'hurry', path: '/eating-habit/reference/i_eat_in_a_hurry.svg' },
//     { name: 'mindfully', path: '/eating-habit/reference/i_eat_mindfully.svg' },
//     { name: 'distracted', path: '/eating-habit/reference/i_eat_while_distracted.svg' }
//   ]);
  
//   // Detection tracking
//   const detectionIntervalRef = useRef(null);
//   const captureTimeoutRef = useRef(null);

//   // Valid corner marker IDs
//   const cornerMarkerIds = [2, 13, 6, 3];

//   // Load reference images
//   useEffect(() => {
//     const loadReferenceImages = async () => {
//       const loadedReferences = await Promise.all(
//         referenceImages.map(async (ref) => {
//           const canvas = document.createElement('canvas');
//           const ctx = canvas.getContext('2d');
//           const img = new Image();
          
//           await new Promise((resolve) => {
//             img.onload = () => {
//               canvas.width = img.width;
//               canvas.height = img.height;
//               ctx.drawImage(img, 0, 0);
//               resolve();
//             };
//             img.src = ref.path;
//           });
          
//           return { ...ref, canvas };
//         })
//       );
      
//       referenceCanvasRef.current = loadedReferences;
//     };
    
//     loadReferenceImages();
//   }, []);

//   // Add the helper function
//   const compareImageSimilarity = (canvas1, canvas2) => {
//     try {
//       const ctx1 = canvas1.getContext('2d');
//       const ctx2 = canvas2.getContext('2d');
      
//       // Use a larger size for better comparison
//       const size = 64;
//       const tempCanvas1 = document.createElement('canvas');
//       const tempCanvas2 = document.createElement('canvas');
//       tempCanvas1.width = tempCanvas1.height = size;
//       tempCanvas2.width = tempCanvas2.height = size;
      
//       const tempCtx1 = tempCanvas1.getContext('2d');
//       const tempCtx2 = tempCanvas2.getContext('2d');
      
//       // Draw resized images with white background
//       tempCtx1.fillStyle = 'white';
//       tempCtx1.fillRect(0, 0, size, size);
//       tempCtx1.drawImage(canvas1, 0, 0, size, size);
      
//       tempCtx2.fillStyle = 'white';
//       tempCtx2.fillRect(0, 0, size, size);
//       tempCtx2.drawImage(canvas2, 0, 0, size, size);
      
//       // Get image data
//       const data1 = tempCtx1.getImageData(0, 0, size, size).data;
//       const data2 = tempCtx2.getImageData(0, 0, size, size).data;
      
//       // Calculate histogram similarity instead of pixel difference
//       const hist1 = calculateColorHistogram(data1);
//       const hist2 = calculateColorHistogram(data2);
      
//       return compareHistograms(hist1, hist2);
//     } catch (error) {
//       throw new Error(`Image comparison failed: ${error.message}`);
//     }
//   };
  
//   const calculateColorHistogram = (data) => {
//     const hist = { r: new Array(8).fill(0), g: new Array(8).fill(0), b: new Array(8).fill(0) };
    
//     for (let i = 0; i < data.length; i += 4) {
//       const r = Math.floor(data[i] / 32);
//       const g = Math.floor(data[i + 1] / 32);
//       const b = Math.floor(data[i + 2] / 32);
      
//       hist.r[r]++;
//       hist.g[g]++;
//       hist.b[b]++;
//     }
    
//     return hist;
//   };
  
//   const compareHistograms = (hist1, hist2) => {
//     let similarity = 0;
//     let total = 0;
    
//     for (let i = 0; i < 8; i++) {
//       similarity += Math.min(hist1.r[i], hist2.r[i]);
//       similarity += Math.min(hist1.g[i], hist2.g[i]);
//       similarity += Math.min(hist1.b[i], hist2.b[i]);
      
//       total += hist1.r[i] + hist1.g[i] + hist1.b[i];
//     }
    
//     return total > 0 ? similarity / total : 0;
//   };
  
// //   const compareImageSimilarity = (canvas1, canvas2) => {
// //     try {
// //       const ctx1 = canvas1.getContext('2d');
// //       const ctx2 = canvas2.getContext('2d');
      
// //       // Resize both to same size for comparison
// //       const size = 64; // Small size for faster comparison
// //       const tempCanvas1 = document.createElement('canvas');
// //       const tempCanvas2 = document.createElement('canvas');
// //       tempCanvas1.width = tempCanvas1.height = size;
// //       tempCanvas2.width = tempCanvas2.height = size;
      
// //       const tempCtx1 = tempCanvas1.getContext('2d');
// //       const tempCtx2 = tempCanvas2.getContext('2d');
      
// //       // Draw resized images
// //       tempCtx1.drawImage(canvas1, 0, 0, size, size);
// //       tempCtx2.drawImage(canvas2, 0, 0, size, size);
      
// //       // Get image data
// //       const data1 = tempCtx1.getImageData(0, 0, size, size).data;
// //       const data2 = tempCtx2.getImageData(0, 0, size, size).data;
      
// //       // Calculate similarity using normalized cross-correlation
// //       let sum1 = 0, sum2 = 0, sum1Sq = 0, sum2Sq = 0, pSum = 0;
// //       const len = data1.length;
      
// //       for (let i = 0; i < len; i += 4) { // Skip alpha channel
// //         const r1 = data1[i], g1 = data1[i + 1], b1 = data1[i + 2];
// //         const r2 = data2[i], g2 = data2[i + 1], b2 = data2[i + 2];
        
// //         // Convert to grayscale
// //         const gray1 = 0.299 * r1 + 0.587 * g1 + 0.114 * b1;
// //         const gray2 = 0.299 * r2 + 0.587 * g2 + 0.114 * b2;
        
// //         sum1 += gray1;
// //         sum2 += gray2;
// //         sum1Sq += gray1 * gray1;
// //         sum2Sq += gray2 * gray2;
// //         pSum += gray1 * gray2;
// //       }
      
// //       const n = len / 4;
// //       const num = pSum - (sum1 * sum2 / n);
// //       const den = Math.sqrt((sum1Sq - sum1 * sum1 / n) * (sum2Sq - sum2 * sum2 / n));
      
// //       return den === 0 ? 0 : num / den;
// //     } catch (error) {
// //       console.error('Image comparison error:', error);
// //       return 0;
// //     }
// //   };
  

//   // Initialize camera
//   useEffect(() => {
//     initializeCamera();
//     return () => {
//       if (videoRef.current?.srcObject) {
//         const tracks = videoRef.current.srcObject.getTracks();
//         tracks.forEach(track => track.stop());
//       }
//       clearDetectionInterval();
//     };
//   }, []);

//   // Handle mode changes
//   useEffect(() => {
//     if (mode === 'verify-poster') {
//       startPosterVerification();
//     } else if (mode === 'detect-zone') {
//       startZoneDetection();
//     }
//   }, [mode]);

//   const clearDetectionInterval = () => {
//     if (detectionIntervalRef.current) {
//       clearInterval(detectionIntervalRef.current);
//       detectionIntervalRef.current = null;
//     }
//   };

//   const initializeCamera = async () => {
//     try {
//       const stream = await navigator.mediaDevices.getUserMedia({
//         video: { facingMode: { ideal: 'environment' } }
//       });
//       if (videoRef.current) {
//         videoRef.current.srcObject = stream;
//         videoRef.current.onloadedmetadata = async () => {
//           await videoRef.current.play();
//           setWarningMessage('Show full poster to verify');
//           setMode('verify-poster');
//         };
//       }
//     } catch (error) {
//       console.error('Camera failed:', error);
//       setWarningMessage('Camera access denied');
//     }
//   };

//   const startPosterVerification = () => {
//     clearDetectionInterval();
    
//     detectionIntervalRef.current = setInterval(() => {
//       if (!videoRef.current || !canvasRef.current || posterVerified) return;
      
//       const video = videoRef.current;
//       const canvas = canvasRef.current;
      
//       if (video.readyState !== 4) return;
      
//       try {
//         const ctx = canvas.getContext('2d');
//         canvas.width = video.videoWidth;
//         canvas.height = video.videoHeight;
//         ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
//         if (!window.AR || !window.AR.Detector) {
//           console.warn('ArUco library not loaded');
//           return;
//         }
        
//         const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
//         const detector = new window.AR.Detector();
//         const markers = detector.detect(imageData);
        
//         // Check if all corner markers are detected
//         const foundIds = markers.map(m => m.id);
//         const allCornersDetected = cornerMarkerIds.every(id => foundIds.includes(id));
        
//         if (allCornersDetected) {
//           setPosterVerified(true);
//           setWarningMessage('Poster verified! Now point camera at one zone');
//           setMode('detect-zone');
//           clearDetectionInterval();
//         }
//       } catch (error) {
//         console.error('ArUco detection error:', error);
//       }
//     }, 300);
//   };

//   const startZoneDetection = () => {
//     clearDetectionInterval();
    
//     detectionIntervalRef.current = setInterval(() => {
//       if (!videoRef.current || !canvasRef.current || !posterVerified) return;
      
//       const video = videoRef.current;
//       const canvas = canvasRef.current;
      
//       if (video.readyState !== 4) return;
      
//       try {
//         const ctx = canvas.getContext('2d');
//         canvas.width = video.videoWidth;
//         canvas.height = video.videoHeight;
//         ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
//         // Detect hand pointing and get the area being pointed at
//         const pointingInfo = detectHandPointingArea(canvas);
//         setHandDetected(pointingInfo.pointing);
        
//         if (pointingInfo.pointing && pointingInfo.pointingArea) {
//           setWarningMessage('Pointing detected! Hold steady to capture...');
          
//           // Draw debug overlay to show pointing area
//           if (canvas.getContext) {
//             const debugCtx = canvas.getContext('2d');
//             debugCtx.strokeStyle = 'red';
//             debugCtx.lineWidth = 3;
//             debugCtx.strokeRect(
//               pointingInfo.pointingArea.x,
//               pointingInfo.pointingArea.y,
//               pointingInfo.pointingArea.width,
//               pointingInfo.pointingArea.height
//             );
            
//             // Draw finger tip
//             debugCtx.fillStyle = 'red';
//             debugCtx.beginPath();
//             debugCtx.arc(pointingInfo.fingerTip.x, pointingInfo.fingerTip.y, 8, 0, 2 * Math.PI);
//             debugCtx.fill();
//           }
          
//           if (!capturing) {
//             startCapture(pointingInfo.pointingArea);
//           }
//         } else {
//           setWarningMessage('Move close to a region and point at it with your finger');
//         }
//       } catch (error) {
//         console.error('Zone detection error:', error);
//       }
//     }, 200); // Faster detection for better responsiveness
//   };
  

//   const detectHandPointingArea = (canvas) => {
//     if (!window.cv) {
//       setDebugInfo(prev => ({ ...prev, openCVLoaded: false, error: 'OpenCV not loaded' }));
//       return { pointing: false, pointingArea: null };
//     }
  
//     try {
//       const src = window.cv.imread(canvas);
//       const hsv = new window.cv.Mat();
//       const mask = new window.cv.Mat();
//       const contours = new window.cv.MatVector();
//       const hierarchy = new window.cv.Mat();
  
//       // Convert to HSV
//       window.cv.cvtColor(src, hsv, window.cv.COLOR_RGB2HSV);
      
//       // Broader skin color range for better detection
//       const lower = new window.cv.Mat(hsv.rows, hsv.cols, hsv.type(), [0, 48, 80, 0]);
//       const upper = new window.cv.Mat(hsv.rows, hsv.cols, hsv.type(), [20, 255, 255, 255]);
//       window.cv.inRange(hsv, lower, upper, mask);
  
//       // Clean up the mask
//       const kernel = window.cv.getStructuringElement(window.cv.MORPH_ELLIPSE, new window.cv.Size(5, 5));
//       window.cv.morphologyEx(mask, mask, window.cv.MORPH_OPEN, kernel);
//       window.cv.morphologyEx(mask, mask, window.cv.MORPH_CLOSE, kernel);
  
//       // Find contours
//       window.cv.findContours(mask, contours, hierarchy, window.cv.RETR_EXTERNAL, window.cv.CHAIN_APPROX_SIMPLE);
  
//       let result = { pointing: false, pointingArea: null };
//       let largestArea = 0;
//       let bestContour = null;
  
//       // Find the largest contour (likely the hand)
//       for (let i = 0; i < contours.size(); i++) {
//         const contour = contours.get(i);
//         const area = window.cv.contourArea(contour);
        
//         if (area > 1500 && area > largestArea) {
//           largestArea = area;
//           bestContour = contour;
//         }
//       }
  
//       if (bestContour) {
//         // Get bounding rectangle of the hand
//         const boundingRect = window.cv.boundingRect(bestContour);
        
//         // Simple approach: use the center-top of the hand as pointing area
//         const centerX = boundingRect.x + boundingRect.width / 2;
//         const topY = boundingRect.y;
        
//         // Create crop area around the estimated pointing location
//         const cropSize = 120;
//         const cropArea = {
//           x: Math.max(0, centerX - cropSize / 2),
//           y: Math.max(0, topY - cropSize / 2),
//           width: Math.min(cropSize, canvas.width - (centerX - cropSize / 2)),
//           height: Math.min(cropSize, canvas.height - (topY - cropSize / 2))
//         };
        
//         result = {
//           pointing: true,
//           pointingArea: cropArea,
//           fingerTip: { x: centerX, y: topY },
//           handArea: largestArea
//         };
        
//         // Update debug info
//         setDebugInfo(prev => ({
//           ...prev,
//           openCVLoaded: true,
//           pointing: true,
//           handArea: largestArea,
//           error: null
//         }));
//       } else {
//         setDebugInfo(prev => ({
//           ...prev,
//           openCVLoaded: true,
//           pointing: false,
//           handArea: 0,
//           error: 'No hand contour found'
//         }));
//       }
  
//       // Cleanup
//       src.delete();
//       hsv.delete();
//       mask.delete();
//       contours.delete();
//       hierarchy.delete();
//       kernel.delete();
//       lower.delete();
//       upper.delete();
  
//       return result;
//     } catch (error) {
//       setDebugInfo(prev => ({
//         ...prev,
//         error: `Detection error: ${error.message}`
//       }));
//       return { pointing: false, pointingArea: null };
//     }
//   };
  
  

//   const startCapture = (pointingArea) => {
//     if (captureTimeoutRef.current || capturing) return;
    
//     setCapturing(true);
//     setWarningMessage('Capturing pointed region...');
    
//     captureTimeoutRef.current = setTimeout(() => {
//       captureAndCompareRegion(pointingArea);
//       captureTimeoutRef.current = null;
//     }, 1500); // Shorter delay for better UX
//   };
  
//   const captureAndCompareRegion = (pointingArea) => {
//     if (!canvasRef.current) {
//       setDebugInfo(prev => ({ ...prev, error: 'No canvas available' }));
//       return;
//     }
  
//     const canvas = canvasRef.current;
//     const ctx = canvas.getContext('2d');
    
//     try {
//       setDebugInfo(prev => ({ ...prev, error: 'Starting capture...' }));
      
//       // Crop the pointed area from the canvas
//       const croppedImageData = ctx.getImageData(
//         Math.floor(pointingArea.x),
//         Math.floor(pointingArea.y),
//         Math.floor(pointingArea.width),
//         Math.floor(pointingArea.height)
//       );
      
//       // Analyze the dominant color in the cropped region
//       const dominantColor = getDominantColor(croppedImageData.data);
//       const matchResults = matchByColor(dominantColor);
      
//       // Update debug info with results
//       setDebugInfo(prev => ({
//         ...prev,
//         matchResults: matchResults,
//         error: `Dominant color: ${dominantColor}`
//       }));
      
//       const bestMatch = matchResults.reduce((prev, current) => 
//         (prev.score > current.score) ? prev : current, { name: 'unknown', score: 0 });
      
//       if (bestMatch.score > 0.4) {
//         setWarningMessage(`Selected: ${bestMatch.name} (${(bestMatch.score * 100).toFixed(1)}% match)`);
        
//         setTimeout(() => {
//           navigate(`/result?qrId=${qrId}&region=${bestMatch.name}`);
//         }, 2000);
//       } else {
//         setWarningMessage(`No clear match. Best: ${bestMatch.name} (${(bestMatch.score * 100).toFixed(1)}%)`);
//         setTimeout(() => {
//           setCapturing(false);
//           setWarningMessage('Try pointing more clearly at a region');
//         }, 2000);
//       }
//     } catch (error) {
//       setDebugInfo(prev => ({
//         ...prev,
//         error: `Capture error: ${error.message}`
//       }));
//       setWarningMessage('Error processing image. Try again.');
//       setCapturing(false);
//     }
//   };
  
//   const getDominantColor = (data) => {
//     const colorCounts = {};
//     let maxCount = 0;
//     let dominantColor = '';
    
//     for (let i = 0; i < data.length; i += 16) { // Sample every 4th pixel
//       const r = data[i];
//       const g = data[i + 1];
//       const b = data[i + 2];
      
//       // Skip very light colors (likely background)
//       if (r > 240 && g > 240 && b > 240) continue;
      
//       // Quantize color to reduce noise
//       const qR = Math.floor(r / 40) * 40;
//       const qG = Math.floor(g / 40) * 40;
//       const qB = Math.floor(b / 40) * 40;
//       const key = `${qR},${qG},${qB}`;
      
//       colorCounts[key] = (colorCounts[key] || 0) + 1;
      
//       if (colorCounts[key] > maxCount) {
//         maxCount = colorCounts[key];
//         dominantColor = key;
//       }
//     }
    
//     return dominantColor;
//   };
  
//   const matchByColor = (dominantColor) => {
//     // Define color profiles for each region - you'll need to adjust these based on your actual SVG colors
//     const colorProfiles = {
//       hurry: [
//         '200,80,80',   // Red-ish colors
//         '240,120,80',  // Orange-ish colors
//         '200,100,100'  // Warm colors
//       ],
//       mindfully: [
//         '80,200,120',  // Green-ish colors
//         '100,180,140', // Light green colors
//         '60,160,100'   // Dark green colors
//       ],
//       distracted: [
//         '80,120,200',  // Blue-ish colors
//         '120,140,220', // Light blue colors
//         '100,100,180'  // Purple-ish colors
//       ]
//     };
    
//     const results = [];
    
//     Object.entries(colorProfiles).forEach(([name, colors]) => {
//       let bestScore = 0;
      
//       colors.forEach(refColor => {
//         const score = calculateColorSimilarity(dominantColor, refColor);
//         if (score > bestScore) {
//           bestScore = score;
//         }
//       });
      
//       results.push({ name, score: bestScore });
//     });
    
//     return results;
//   };
  
//   const calculateColorSimilarity = (color1, color2) => {
//     if (!color1 || !color2) return 0;
    
//     const [r1, g1, b1] = color1.split(',').map(Number);
//     const [r2, g2, b2] = color2.split(',').map(Number);
    
//     const distance = Math.sqrt(
//       Math.pow(r1 - r2, 2) + 
//       Math.pow(g1 - g2, 2) + 
//       Math.pow(b1 - b2, 2)
//     );
    
//     // Convert distance to similarity (0-1 scale)
//     const maxDistance = Math.sqrt(3 * Math.pow(255, 2));
//     return Math.max(0, 1 - distance / maxDistance);
//   };
  
  
  
  


  

//   const handleReset = () => {
//     setPosterVerified(false);
//     setHandDetected(false);
//     setCapturing(false);
//     setWarningMessage('Show full poster to verify');
//     setMode('verify-poster');
    
//     if (captureTimeoutRef.current) {
//       clearTimeout(captureTimeoutRef.current);
//       captureTimeoutRef.current = null;
//     }
//   };

//   return (
//     <div className="flex flex-col items-center p-4 max-w-md mx-auto bg-[#f3e8d4] min-h-[100dvh]">
//       <h1 className="text-2xl font-bold text-[#046a81] mb-4">Zone Selector</h1>
      
//       {qrId && (
//         <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
//           <p className="text-blue-800 font-medium">QR ID: {qrId}</p>
//         </div>
//       )}
      
//       <div className="relative w-full mb-4" style={{ height: '400px' }}>
//         <video
//           ref={videoRef}
//           playsInline
//           autoPlay
//           muted
//           style={{ display: 'none' }}
//         />
        
//         <canvas
//           ref={canvasRef}
//           className="w-full h-full object-contain rounded-lg border-2 border-gray-300 shadow-md"
//         />

        
        
//         <div className="absolute bottom-2 left-2 right-2 flex justify-center">
//           <div className="bg-black bg-opacity-70 text-white px-3 py-1 rounded-full text-sm text-center">
//             {warningMessage}
//           </div>
//         </div>

// {/* Enhanced Debug Panel */}
// <div className="absolute top-2 left-2 bg-black bg-opacity-80 text-white p-2 rounded text-xs max-w-xs">
//   <div className="mb-1">OpenCV: {debugInfo.openCVLoaded ? '✅' : '❌'}</div>
//   <div className="mb-1">Hand: {debugInfo.pointing ? '✅' : '❌'}</div>
//   <div className="mb-1">Refs: {referenceCanvasRef.current?.length || 0}/3</div>
//   {debugInfo.handArea && (
//     <div className="mb-1">Area: {debugInfo.handArea}</div>
//   )}
//   {debugInfo.error && (
//     <div className="mb-1 text-yellow-300">Status: {debugInfo.error}</div>
//   )}
//   {debugInfo.matchResults && (
//     <div className="mb-1">
//       <div>Matches:</div>
//       {debugInfo.matchResults.map(result => (
//         <div key={result.name} className="ml-2">
//           {result.name}: {(result.score * 100).toFixed(1)}%
//         </div>
//       ))}
//     </div>
//   )}
// </div>

        
//         {mode === 'detect-zone' && (
//           <div className="absolute top-2 right-2">
//             <div className="px-2 py-1 rounded text-xs font-medium bg-green-500 text-white">
//               Zone Detection Active
//             </div>
//           </div>
//         )}
//       </div>
      
//       <div className="w-full mb-4">
//         {mode === 'verify-poster' ? (
//           <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-3">
//             <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
//             <div>
//               <p className="text-blue-800 font-medium text-sm">Verifying poster...</p>
//               <p className="text-blue-600 text-xs">Show full poster with all markers</p>
//             </div>
//           </div>
//         ) : (
//           <div className={`p-3 rounded-lg border flex items-center gap-3 ${
//             handDetected 
//               ? 'bg-green-50 border-green-200' 
//               : 'bg-orange-50 border-orange-200'
//           }`}>
//             <div className={`w-3 h-3 rounded-full ${
//               handDetected ? 'bg-green-500' : 'bg-orange-500 animate-pulse'
//             }`}></div>
//             <div>
//               <p className={`font-medium text-sm ${
//                 handDetected ? 'text-green-800' : 'text-orange-800'
//               }`}>
//                 {handDetected ? 'Ready to capture' : 'Point camera at zone'}
//               </p>
//               <p className={`text-xs ${
//                 handDetected ? 'text-green-600' : 'text-orange-600'
//               }`}>
//                 {handDetected ? 'Hold steady...' : 'Show your hand in the zone'}
//               </p>
//             </div>
//           </div>
//         )}
//       </div>
      
//       <button
//         onClick={handleReset}
//         className="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
//       >
//         Reset
//       </button>
//     </div>
//   );
// };

// export default SimplePosterSelector;

