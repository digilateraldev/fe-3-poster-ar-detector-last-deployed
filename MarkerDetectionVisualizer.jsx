import React, { useEffect, useRef, useState } from 'react';

const MarkerDetectionVisualizer = ({ onFourMarkersDetected }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [croppedImage, setCroppedImage] = useState(null);
  const [videoAspectRatio, setVideoAspectRatio] = useState(4 / 3);

  useEffect(() => {
    if (!window.cv || !window.AR) {
      console.error("❌ OpenCV or ArUco not loaded. Make sure scripts are included in index.html");
      return;
    }

    const cv = window.cv;
    const AR = window.AR;
    const detector = new AR.Detector();

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    const startCamera = async () => {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      video.srcObject = stream;
      video.onloadedmetadata = () => {
        setVideoAspectRatio(video.videoWidth / video.videoHeight);
      };
      await video.play();
    };

    const getWarpedImage = (srcCanvas, corners) => {
      const srcMat = cv.imread(srcCanvas);

      const srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, corners.flat());

      const width = video.videoWidth ;
      const height = video.videoHeight ;

      const dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
        0, 0,
        width, 0,
        width, height,
        0, height,
      ]);

      const M = cv.getPerspectiveTransform(srcTri, dstTri);
      const dst = new cv.Mat();
      const dsize = new cv.Size(width, height);
      cv.warpPerspective(srcMat, dst, M, dsize, cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());

      const resultCanvas = document.createElement("canvas");
      resultCanvas.width = width;
      resultCanvas.height = height;
      cv.imshow(resultCanvas, dst);
      const dataUrl = resultCanvas.toDataURL();
      setCroppedImage(dataUrl);
      onFourMarkersDetected && onFourMarkersDetected(dataUrl);

      srcMat.delete();
      dst.delete();
      M.delete();
      srcTri.delete();
      dstTri.delete();
    };

    let processed = false;

    const process = () => {
      if (!video || video.readyState !== 4) {
        requestAnimationFrame(process);
        return;
      }

      // Set canvas to video's native dimensions for processing
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const markers = detector.detect(imageData);

      const requiredIds = [0, 1, 2, 3];
      const foundMarkers = requiredIds.map(id => markers.find(m => m.id === id));

      if (foundMarkers.every(Boolean) && !processed) {
        console.log("✅ All 4 markers detected:", foundMarkers.map(m => m.id).join(', '));
        processed = true;

        const idMap = {};
        foundMarkers.forEach(m => {
          idMap[m.id] = m;
        });

        const topLeft     = idMap[0].corners[3]; // ID 0 - outer top-left corner
        const topRight    = idMap[2].corners[0]; // ID 2 - outer top-right corner  
        const bottomRight = idMap[3].corners[2]; // ID 3 - outer bottom-right corner
        const bottomLeft  = idMap[1].corners[0]; // ID 1 - outer bottom-left corner

        const orderedCorners = [topLeft, topRight, bottomRight, bottomLeft];

        context.strokeStyle = 'lime';
        context.lineWidth = 3;
        context.beginPath();
        orderedCorners.forEach((pt, i) => {
          const next = orderedCorners[(i + 1) % 4];
          context.moveTo(pt.x, pt.y);
          context.lineTo(next.x, next.y);
        });
        context.stroke();

        getWarpedImage(canvas, orderedCorners.map(pt => [pt.x, pt.y]));
      }

      requestAnimationFrame(process);
    };

    startCamera().then(() => {
      requestAnimationFrame(process);
    });

    return () => {
      const stream = video.srcObject;
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return (
    <div className="flex flex-col items-center p-4 max-w-md mx-auto bg-[#f3e8d4] h-[100dvh]">
      <h1 className="text-2xl font-bold text-[#046a81]">Scanner</h1>
      
      {!croppedImage ? (
        <div className="relative w-full" style={{ height: '500px' }}>
          <video 
            ref={videoRef} 
            playsInline 
            autoPlay 
            muted 
            style={{ display: 'none' }} 
          />
          <div 
            className="absolute inset-0 flex justify-center items-center"
            style={{
              aspectRatio: videoAspectRatio,
              maxWidth: '100%',
              maxHeight: '100%',
              margin: 'auto'
            }}
          >
            <canvas 
              ref={canvasRef} 
              className="w-full h-full object-contain rounded-lg border-2 border-gray-300 shadow-md"
            />
          </div>
          <div className="absolute bottom-0 left-0 right-0 flex justify-center">
            <div className="bg-black bg-opacity-70 text-white px-3 py-1 rounded-full text-sm">
              Align all 4 markers in view
            </div>
          </div>
          {/* <div className="absolute -bottom-24 left-0 right-0 px-6">
            <p className="text-sm font-semibold text-gray-800 mb-1 tracking-wide">📋 Scanning Guide</p>
            <ul className="text-xs text-gray-700 space-y-0.5 list-disc list-inside">
              <li>Ensure good lighting</li>
              <li>Hold steady and align all 4 markers</li>
              <li>Keep the document fully within the frame</li>
            </ul>
          </div> */}
        </div>
      ) : (
        <div className="w-full">
          <div className="flex justify-center items-center h-full w-auto bg-gray-300 rounded-lg mb-4">
            {croppedImage ? (
              <img 
                src={croppedImage} 
                alt="Cropped document" 
                className="max-h-full max-w-full object-contain rounded border border-gray-200 shadow-sm"
              />
            ) : (
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-2"></div>
                <p className="text-gray-600">Processing document...</p>
              </div>
            )}
          </div>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center gap-4">
            <div className="w-5 h-5 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin"></div>
            <div>
              <p className="text-blue-800 font-medium">Document captured successfully</p>
              <p className="text-blue-600 text-sm mt-0.5">Processing your document...</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MarkerDetectionVisualizer;