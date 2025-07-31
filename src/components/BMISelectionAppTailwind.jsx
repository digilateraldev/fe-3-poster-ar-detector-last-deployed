/* Integrated BMI Pointer with ArUco Markers + Hand/Fingertip Detection - Tailwind Version */
import React, { useEffect, useRef, useState } from "react";
import { Hands } from "@mediapipe/hands";
import { apiUtils, deviceIdManager } from "../utils/deviceId";

const zones = {
  distracted: [
    [703, 671],
    [1622, 652],
    [1628, 1312],
    [823, 1328],
  ],
  hurry: [
    [82, 1125],
    [748, 1133],
    [740, 1850],
    [66, 1860],
  ],
  mindfully: [
    [852, 1534],
    [1620, 1531],
    [1633, 2186],
    [802, 2192],
  ],
};

const zoneInfo = {
  hurry: {
    title: "I eat in hurry",
    videoUrl: "/videos/hurry.mp4",
  },
  mindfully: {
    title: "I eat mindfully",
    videoUrl: "/videos/mindfully.mp4",
  },
  distracted: {
    title: "I eat while distracted",
    videoUrl: "/videos/distracted.mp4",
  },
};

const BMISelectionAppTailwind = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const pointerRef = useRef(null);
  const resultRef = useRef(null);
  const containerRef = useRef(null);
  const detectionCanvasRef = useRef(null);
  
  const [posterInView, setPosterInView] = useState(false);
  const [warningMessage, setWarningMessage] = useState("Initializing...");
  const [detectionMode, setDetectionMode] = useState("hand");
  const [currentZone, setCurrentZone] = useState(null);
  const [qrId, setQrId] = useState(null);
  const [showToast, setShowToast] = useState(false);
  const [detectedRegion, setDetectedRegion] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const lastDetectedIdsRef = useRef([]);
  const hasBeenAligned = useRef(false);
  const handsRef = useRef(null);
  const handDetectionFailCount = useRef(0);
  const zoneTimeoutRef = useRef(null);

  const cornerZones = {
    2: { x: 200, y: 50 },
    13: { x: 480, y: 50 },
    6: { x: 190, y: 450 },
    3: { x: 480, y: 450 },
  };

  const BUFFER = 170;

  function isInCorner(marker, id) {
    const expected = cornerZones[id];
    if (!expected || !marker?.corners) return false;

    const cx = marker.corners.reduce((sum, pt) => sum + pt.x, 0) / 4;
    const cy = marker.corners.reduce((sum, pt) => sum + pt.y, 0) / 4;

    const inCorner =
      Math.abs(cx - expected.x) < BUFFER && Math.abs(cy - expected.y) < BUFFER;

    console.log(
      `Marker ${id} center: (${Math.round(cx)}, ${Math.round(
        cy
      )}), expected: (${expected.x}, ${expected.y}), match: ${inCorner}`
    );

    return inCorner;
  }

  // RGB to HSV conversion function
  const rgbToHsv = (r, g, b) => {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const diff = max - min;

    let h = 0;
    let s = 0;
    const v = max;

    if (diff !== 0) {
      s = diff / max;

      switch (max) {
        case r:
          h = ((g - b) / diff) % 6;
          break;
        case g:
          h = (b - r) / diff + 2;
          break;
        case b:
          h = (r - g) / diff + 4;
          break;
      }
      h = h * 60;
      if (h < 0) h += 360;
    }

    return [h, s, v];
  };

  // Fingertip detection using contours
  const detectFingertipFromContours = (imageData, width, height) => {
    try {
      const canvas = detectionCanvasRef.current;
      if (!canvas) return null;

      const ctx = canvas.getContext("2d");
      canvas.width = width;
      canvas.height = height;

      ctx.putImageData(imageData, 0, 0);

      const data = imageData.data;
      const skinMask = new Uint8ClampedArray(width * height);

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i] / 255.0;
        const g = data[i + 1] / 255.0;
        const b = data[i + 2] / 255.0;

        const hsv = rgbToHsv(r, g, b);
        const h = hsv[0];
        const s = hsv[1];
        const v = hsv[2];

        const isSkin =
          h >= 0 &&
          h <= 20 &&
          s >= 48 / 255 &&
          s <= 1.0 &&
          v >= 80 / 255 &&
          v <= 1.0;

        skinMask[Math.floor(i / 4)] = isSkin ? 255 : 0;
      }

      const contours = findContours(skinMask, width, height);

      if (contours.length === 0) return null;

      let largestContour = contours[0];
      let maxArea = contourArea(largestContour);

      for (let i = 1; i < contours.length; i++) {
        const area = contourArea(contours[i]);
        if (area > maxArea && area > 500) {
          maxArea = area;
          largestContour = contours[i];
        }
      }

      if (maxArea < 500) return null;

      let topmost = largestContour[0];
      for (const point of largestContour) {
        if (point.y < topmost.y) {
          topmost = point;
        }
      }

      return {
        x: (topmost.x / width) * 1517,
        y: (topmost.y / height) * 2200,
      };
    } catch (error) {
      console.error("Fingertip detection error:", error);
      return null;
    }
  };

  const findContours = (mask, width, height) => {
    const contours = [];
    const visited = new Array(width * height).fill(false);

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        if (mask[idx] === 255 && !visited[idx]) {
          const contour = traceContour(mask, width, height, x, y, visited);
          if (contour.length > 10) {
            contours.push(contour);
          }
        }
      }
    }

    return contours;
  };

  const traceContour = (mask, width, height, startX, startY, visited) => {
    const contour = [];
    const stack = [{ x: startX, y: startY }];

    while (stack.length > 0) {
      const { x, y } = stack.pop();
      const idx = y * width + x;

      if (
        x < 0 ||
        x >= width ||
        y < 0 ||
        y >= height ||
        visited[idx] ||
        mask[idx] !== 255
      ) {
        continue;
      }

      visited[idx] = true;
      contour.push({ x, y });

      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          stack.push({ x: x + dx, y: y + dy });
        }
      }
    }

    return contour;
  };

  const contourArea = (contour) => {
    if (contour.length < 3) return 0;

    let area = 0;
    for (let i = 0; i < contour.length; i++) {
      const j = (i + 1) % contour.length;
      area += contour[i].x * contour[j].y;
      area -= contour[j].x * contour[i].y;
    }
    return Math.abs(area) / 2;
  };

  const handleZoneDetection = (zoneName) => {
    if (zoneName !== currentZone) {
      setCurrentZone(zoneName);

      if (zoneTimeoutRef.current) clearTimeout(zoneTimeoutRef.current);

      zoneTimeoutRef.current = setTimeout(() => {
        if (zoneName && zoneInfo[zoneName]) {
          setDetectedRegion(zoneName);
          // setShowToast(true);
          handleSubmit(zoneName);
        }
      }, 300);
    }
  };

  const handleSubmit = async (detectedRegion) => {
    try {
      setIsProcessing(true);
      
      // Get qrId from URL parameters
      const urlParams = new URLSearchParams(window.location.search);
      const currentQrId = urlParams.get("qrId");
      
      if (!currentQrId || !detectedRegion) {
        alert(
          "Missing QR ID or Region.\n\nqrId: " +
            currentQrId +
            "\nregion: " +
            detectedRegion
        );
        return;
      }

      // await apiUtils.post("/selection/store", {
      //   qrId: currentQrId,
      //   selection: detectedRegion,
      // });

      // window.location.href = `/eating-habit/selection/result?qrId=${currentQrId}&region=${detectedRegion}`;
      window.location.replace(`/eating-habit/selection/result?qrId=${currentQrId}&region=${detectedRegion}`);

    } catch (err) {
      let errorMessage = "Submission failed. Please try again.";
      if (err?.message) {
        errorMessage += `\n\nError: ${err.message}`;
      } else if (typeof err === "string") {
        errorMessage += `\n\nError: ${err}`;
      } else {
        errorMessage += `\n\nAn unknown error occurred.`;
      }
      alert(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRetry = () => {
    setShowToast(false);
    setDetectedRegion(null);
    setCurrentZone(null);
  };

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    setQrId(urlParams.get("qrId"));

    const isPointInZone = (point, zone, buffer = 80) => {
      const [x, y] = point;
      
      // Create a smaller zone by adding buffer inward from all edges
      const bufferedZone = [];
      const centerX = zone.reduce((sum, pt) => sum + pt[0], 0) / zone.length;
      const centerY = zone.reduce((sum, pt) => sum + pt[1], 0) / zone.length;
      
      for (let i = 0; i < zone.length; i++) {
        const [zx, zy] = zone[i];
        // Move each point toward the center by buffer amount
        const dx = centerX - zx;
        const dy = centerY - zy;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > buffer) {
          const ratio = (distance - buffer) / distance;
          bufferedZone.push([
            centerX - dx * ratio,
            centerY - dy * ratio
          ]);
        } else {
          // If buffer is too large, use original point
          bufferedZone.push([zx, zy]);
        }
      }
      
      // Check if point is inside the buffered (smaller) zone
      let inside = false;
      for (let i = 0, j = bufferedZone.length - 1; i < bufferedZone.length; j = i++) {
        const [xi, yi] = bufferedZone[i];
        const [xj, yj] = bufferedZone[j];
        const intersect =
          yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
        if (intersect) inside = !inside;
      }
      return inside;
    };

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

        if (
          results.multiHandLandmarks &&
          results.multiHandLandmarks.length > 0
        ) {
          const indexTip = results.multiHandLandmarks[0][8];
          fingerTip = {
            x: indexTip.x * 1517,
            y: indexTip.y * 2200,
          };
          handDetectionFailCount.current = 0;
          setDetectionMode("hand");
        } else {
          handDetectionFailCount.current++;

          if (handDetectionFailCount.current > 3) {
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
                  fingerTip = detectedTip;
                }
              } catch (error) {
                console.error("Error in fingertip detection:", error);
              }
            }
          }
        }

        if (fingerTip) {
          const { x, y } = fingerTip;

          if (pointerRef.current) {
            pointerRef.current.style.display = "block";
            pointerRef.current.style.left = `${x}px`;
            pointerRef.current.style.top = `${y}px`;
          }

          let detected = null;
          for (const [zoneName, zone] of Object.entries(zones)) {
            if (isPointInZone([x, y], zone)) {
              detected = zoneName;
              break;
            }
          }

          if (resultRef.current) {
            resultRef.current.textContent = detected
              ? `Detected: ${detected} (${detectionMode} mode)`
              : "Point to select your eating style";
          }

          handleZoneDetection(detected);
          setWarningMessage("");
        } else {
          if (pointerRef.current) {
            pointerRef.current.style.display = "none";
          }
          if (resultRef.current) {
            resultRef.current.textContent = posterInView ? "No finger detected" : "Show all 4 markers";
          }
          if (posterInView) {
            setWarningMessage(
              "👆 Hand not detected. Keep your index finger visible."
            );
          } else {
            setWarningMessage("");
          }
          handleZoneDetection(null);
        }
      });

      const detector = new window.AR.Detector();

      const detectLoop = async () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas) return;

        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const markers = detector.detect(imageData);

        if (markers.length > 0) {
          console.log("Detected marker(s):");
          markers.forEach((marker) => {
            const cx = marker.corners.reduce((sum, pt) => sum + pt.x, 0) / 4;
            const cy = marker.corners.reduce((sum, pt) => sum + pt.y, 0) / 4;
            console.log(
              `  ↳ Marker ${marker.id} center: (${Math.round(cx)}, ${Math.round(
                cy
              )})`
            );
          });
        }

        const detectedIds = markers.map((m) => m.id).sort();

        const matchedMarkers = markers.filter((marker) =>
          isInCorner(marker, marker.id)
        );
        const matchedIds = matchedMarkers.map((m) => m.id).sort();

        const lastDetected = lastDetectedIdsRef.current.join(",");
        const currentDetected = matchedIds.join(",");

        if (lastDetected !== currentDetected) {
          console.log(" Marker IDs changed:", matchedIds);
          lastDetectedIdsRef.current = matchedIds;
        }

        if (!hasBeenAligned.current && matchedIds.length === 4) {
          hasBeenAligned.current = true;
          console.log("Poster aligned!");
        }

        const visible = hasBeenAligned.current
          ? matchedIds.length >= 3
          : matchedIds.length === 4;

        setPosterInView(visible);

        if (matchedIds.length > 0) {
          setWarningMessage(`Markers visible: ${matchedIds.join(", ")}`);
        } else {
          setWarningMessage("No markers detected");
        }

        if (visible) {
          await hands.send({ image: video });
          setWarningMessage("");
        } else {
          if (pointerRef.current) {
            pointerRef.current.style.display = "none";
          }
          if (resultRef.current) {
            resultRef.current.textContent = "Align poster with 4 markers";
          }
        //   setWarningMessage("📄Poster not aligned. Show all 4 ArUco markers.");
          handleZoneDetection(null);
        }

        requestAnimationFrame(detectLoop);
      };

      const scaleContainer = () => {
        const wrapper = containerRef.current?.parentElement;
        if (!wrapper || !containerRef.current) return;

        const scaleX = wrapper.clientWidth / 1517;
        const scaleY = wrapper.clientHeight / 2200;
        containerRef.current.style.transform = `scale(${scaleX}, ${scaleY})`;
      };

      scaleContainer();
      window.addEventListener("resize", scaleContainer);
      detectLoop();
    });
  }, []);

  return (
    <div className="flex flex-col items-center p-4 bg-[#f3e8d4] h-[100dvh]">
      <h1 className="text-2xl font-bold text-[#046a81] mb-4">Scanner</h1>
      
      <div
        className="wrapper relative bg-black overflow-hidden"
        style={{
          width: "100vw",
          height: "calc(100vw * 2200 / 1517)",
          maxHeight: "100vh",
          maxWidth: "calc(100vh * 1517 / 2200)",
          margin: "auto",
        }}
      >
        <div
          id="container"
          ref={containerRef}
          className="absolute inset-0"
          style={{
            width: "1517px",
            height: "2200px",
            transformOrigin: "top left",
          }}
        >
          {/* Video Element */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />

          {/* Hidden Canvas Elements */}
          <canvas
            ref={canvasRef}
            width={1517}
            height={2200}
            className="absolute inset-0 hidden"
          />

          <canvas
            ref={detectionCanvasRef}
            className="hidden"
          />

          {/* Pointer */}
          <div
            ref={pointerRef}
            className={`absolute w-8 h-8 rounded-full border-2 border-white pointer-events-none hidden transform -translate-x-1/2 -translate-y-1/2 ${
              detectionMode === "hand" ? "bg-green-500" : "bg-orange-500"
            } bg-opacity-70`}
          />

          {/* Result Display */}
          <div
            ref={resultRef}
            className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-80 text-white px-4 py-2 rounded-lg text-sm font-medium max-w-xs text-center"
          >
            Loading...
          </div>

          {/* Warning Message */}
          {warningMessage && (
            <div className="absolute bottom-16 left-1/2 transform -translate-x-1/2 bg-orange-100 border border-orange-300 text-orange-800 px-3 py-2 rounded-lg text-xs font-medium max-w-xs text-center">
              ⚠️ {warningMessage}
            </div>
          )}

          {/* Instructions */}
          {/* <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-80 text-white px-3 py-2 rounded-lg text-xs text-center max-w-xs">
            <div className="mb-1">📱 Align poster with frame</div>
            <div className="mb-1">👆 Point with index finger</div>
            <div className="text-xs opacity-75">
              Mode: {detectionMode} | 
              {detectionMode === "hand" ? " 🟢 " : " 🟠 "}
            </div>
          </div> */}
        </div>
      </div>

      {/* Status Indicator */}
      <div className="mt-4 w-full">
        {posterInView ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-3">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <div>
              <p className="text-green-800 font-medium text-sm">Poster aligned</p>
              <p className="text-green-600 text-xs">Point to select your eating style</p>
            </div>
          </div>
        ) : (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 flex items-center gap-3">
            <div className="w-3 h-3 bg-orange-500 rounded-full animate-pulse"></div>
            <div>
              <p className="text-orange-800 font-medium text-sm">Aligning poster...</p>
              <p className="text-orange-600 text-xs">Show all 4 markers</p>
            </div>
          </div>
        )}
      </div>

      {/* Selection Toast */}
      {showToast && detectedRegion && zoneInfo[detectedRegion] && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-2xl">
            <div className="text-center mb-4">
              {/* <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl">🍽️</span>
              </div> */}
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Selection Detected
              </h3>
              <p className="text-gray-600">
                You selected:{" "}
                <span className="font-medium text-gray-900">
                  {zoneInfo[detectedRegion]?.title || detectedRegion}
                </span>
              </p>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={handleRetry}
                disabled={isProcessing}
                className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                Retry
              </button>
              <button
                onClick={handleSubmit}
                disabled={isProcessing}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Submitting...
                  </>
                ) : (
                  "Submit"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BMISelectionAppTailwind;
