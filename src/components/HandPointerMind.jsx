import React, { useRef, useEffect, useState } from "react";
import { Hands } from "@mediapipe/hands";
import * as cam from "@mediapipe/camera_utils";

export default function HandPointerDetector({ onPointingDetected }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [pointing, setPointing] = useState(false);

  useEffect(() => {
    const videoElement = videoRef.current;
    const canvasElement = canvasRef.current;
    const canvasCtx = canvasElement.getContext("2d");

    const hands = new Hands({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });

    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      selfieMode: true, // ✅ false for front camera (laptop), true for rear (phone)
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.6,
    });

    hands.onResults((results) => {
      canvasCtx.save();
      canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

      if (
        results.multiHandLandmarks &&
        results.multiHandLandmarks.length > 0
      ) {
        const landmarks = results.multiHandLandmarks[0];

        // Draw landmarks
        for (let point of landmarks) {
          const x = point.x * canvasElement.width;
          const y = point.y * canvasElement.height;
          canvasCtx.beginPath();
          canvasCtx.arc(x, y, 5, 0, 2 * Math.PI);
          canvasCtx.fillStyle = "rgba(0, 255, 0, 0.8)";
          canvasCtx.fill();
        }

        // Check if pointing gesture
        const isPointing = checkIfPointing(landmarks);
        setPointing(isPointing);
        if (onPointingDetected) onPointingDetected(isPointing);
      } else {
        setPointing(false);
        if (onPointingDetected) onPointingDetected(false);
      }

      canvasCtx.restore();
    });

    const camera = new cam.Camera(videoElement, {
      onFrame: async () => {
        await hands.send({ image: videoElement });
      },
      width: 640,
      height: 480,
    });

    camera.start();

    return () => {
      camera.stop();
    };
  }, []);

  return (
    <div className="relative w-[640px] h-[480px] bg-black rounded-lg overflow-hidden">
      <video
        ref={videoRef}
        style={{ display: "none" }}
        className="absolute top-0 left-0"
      />
      <canvas
        ref={canvasRef}
        width={640}
        height={480}
        className="absolute top-0 left-0 z-10"
      />
      <div className="absolute bottom-2 left-2 p-2 bg-white rounded shadow text-sm font-medium text-gray-800">
        {pointing ? "👉 Pointing Detected" : "🖐️ No pointing"}
      </div>
    </div>
  );
}

// Heuristic: index extended, others curled
function checkIfPointing(landmarks) {
  const INDEX_TIP = 8;
  const MIDDLE_TIP = 12;
  const RING_TIP = 16;
  const PINKY_TIP = 20;

  const WRIST = 0;

  const isFingerExtended = (tipIndex, baseIndex) => {
    return landmarks[tipIndex].y < landmarks[baseIndex].y;
  };

  const indexUp = isFingerExtended(INDEX_TIP, 6); // index MCP
  const middleDown = !isFingerExtended(MIDDLE_TIP, 10);
  const ringDown = !isFingerExtended(RING_TIP, 14);
  const pinkyDown = !isFingerExtended(PINKY_TIP, 18);

  return indexUp && middleDown && ringDown && pinkyDown;
}
