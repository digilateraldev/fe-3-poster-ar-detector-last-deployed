/* Integrated BMI Pointer with ArUco Markers + Hand/Fingertip Detection - Tailwind Version */
import React, { useEffect, useRef, useState } from "react";
import { Hands } from "@mediapipe/hands";
import { apiUtils, deviceIdManager } from "../utils/deviceId";

// const normalizedZones = {
//   distracted: [
//     [0.463, 0.305],
//     [1, 0.296],
//     [1, 0.596],
//     [0.542, 0.603],
//   ],
//   hurry: [
//     [0.043, 0.511],
//     [0.493, 0.515],
//     [0.488, 0.84],
//     [0.039, 0.845],
//   ],
//   mindfully: [
//     [0.561, 0.697],
//     [1, 0.695],
//     [1, 1],
//     [0.529, 1],
//   ],
// };

const normalizedZones = {
  distracted: [
    [0.463, 0.305],
    [1, 0.296],
    [1, 0.596],
    [0.542, 0.603],
  ],
  hurry: [
    [0.06, 0.5],
    [0.51, 0.504],
    [0.505, 0.835],
    [0.055, 0.84],
  ],
  // Make mindfully zone much larger and moved up more
  mindfully: [
    [0.5, 0.65], // was [0.540, 0.680] - moved left and up more
    [1, 0.645], // was [1, 0.675] - moved up more
    [1, 1], // keep same
    [0.48, 1], // was [0.510, 1] - moved left more to make wider
  ],
};

const zoneInfo = {
  hurry: {
    title: "I eat in a hurry",
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

// Helper functions
function getPerspectiveTransformMatrix(src, dst) {
  if (!window.cv) return null;
  try {
    const srcMat = window.cv.matFromArray(4, 1, window.cv.CV_32FC2, src.flat());
    const dstMat = window.cv.matFromArray(4, 1, window.cv.CV_32FC2, dst.flat());
    const M = window.cv.getPerspectiveTransform(srcMat, dstMat);
    srcMat.delete();
    dstMat.delete();
    return M;
  } catch (error) {
    console.error("Error creating perspective transform:", error);
    return null;
  }
}

function warpPoint(matrix, point) {
  if (!window.cv || !matrix) return point;
  try {
    const src = window.cv.matFromArray(1, 1, window.cv.CV_32FC2, [
      point.x,
      point.y,
    ]);
    const dst = new window.cv.Mat();
    window.cv.perspectiveTransform(src, dst, matrix);
    const result = dst.data32F;
    src.delete();
    dst.delete();
    return { x: result[0], y: result[1] };
  } catch (error) {
    console.error("Error warping point:", error);
    return point;
  }
}

function pointInNormalizedZone(pt, zone) {
  let inside = false;
  for (let i = 0, j = zone.length - 1; i < zone.length; j = i++) {
    const [xi, yi] = zone[i];
    const [xj, yj] = zone[j];
    const intersect =
      yi > pt.y !== yj > pt.y &&
      pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

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
  const [progressPercent, setProgressPercent] = useState(0);

  const lastDetectedIdsRef = useRef([]);
  const hasBeenAligned = useRef(false);
  const handsRef = useRef(null);
  const handDetectionFailCount = useRef(0);
  const zoneTimeoutRef = useRef(null);
  const zoneStartTimeRef = useRef(null);
  const lastDetectedZoneRef = useRef(null);
  const posterCornersRef = useRef([]);
  const maskCanvasRef = useRef(null);

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

    return inCorner;
  }

  // const detectFingertipFromContours = (imageData, width, height) => {
  //   try {
  //     const canvas = detectionCanvasRef.current;
  //     if (!canvas) return null;

  //     const ctx = canvas.getContext("2d");
  //     canvas.width = width;
  //     canvas.height = height;
  //     ctx.putImageData(imageData, 0, 0);

  //     // Convert to OpenCV Mat
  //     let src = window.cv.matFromImageData(imageData);
  //     let hsv = new window.cv.Mat();
  //     let mask = new window.cv.Mat();
  //     let kernel = window.cv.getStructuringElement(
  //       window.cv.MORPH_ELLIPSE,
  //       new window.cv.Size(5, 5)
  //     );

  //     // Convert to HSV and threshold skin color
  //     window.cv.cvtColor(src, src, window.cv.COLOR_RGBA2RGB);
  //     window.cv.cvtColor(src, hsv, window.cv.COLOR_RGB2HSV);

  //     let lower = new window.cv.Mat(
  //       hsv.rows,
  //       hsv.cols,
  //       hsv.type(),
  //       // [0, 48, 80, 0]
  //        [0, 20, 70, 0]
  //     );
  //     let upper = new window.cv.Mat(
  //       hsv.rows,
  //       hsv.cols,
  //       hsv.type(),
  //       // [20, 255, 255, 255]
  //       [50, 255, 255, 255]
  //     );
  //     window.cv.inRange(hsv, lower, upper, mask);

  //     //  ADD MISSING MORPHOLOGICAL OPERATIONS
  //     window.cv.morphologyEx(
  //       mask,
  //       mask,
  //       window.cv.MORPH_CLOSE,
  //       kernel,
  //       new window.cv.Point(-1, -1),
  //       2
  //     );
  //     window.cv.morphologyEx(
  //       mask,
  //       mask,
  //       window.cv.MORPH_OPEN,
  //       kernel,
  //       new window.cv.Point(-1, -1),
  //       2
  //     );

  //     // Find contours
  //     let contours = new window.cv.MatVector();
  //     let hierarchy = new window.cv.Mat();
  //     window.cv.findContours(
  //       mask,
  //       contours,
  //       hierarchy,
  //       window.cv.RETR_EXTERNAL,
  //       window.cv.CHAIN_APPROX_SIMPLE
  //     );

  //     //  ADD MISSING CONVEXITY DEFECT ANALYSIS
  //     let bestContour = null;
  //     let maxScore = -1;

  //     for (let i = 0; i < contours.size(); i++) {
  //       let cnt = contours.get(i);
  //       let area = window.cv.contourArea(cnt);
  //       if (area < 500) continue;

  //       let hull = new window.cv.Mat();
  //       window.cv.convexHull(cnt, hull, false, false);

  //       if (hull.total() > 3) {
  //         let defects = new window.cv.Mat();
  //         let hullIndices = new window.cv.Mat();
  //         window.cv.convexHull(cnt, hullIndices, false, true);
  //         window.cv.convexityDefects(cnt, hullIndices, defects);

  //         if (!defects.empty()) {
  //           if (defects.rows > maxScore) {
  //             maxScore = defects.rows;
  //             bestContour = cnt;
  //           }
  //         }

  //         hull.delete();
  //         hullIndices.delete();
  //         defects.delete();
  //       }
  //     }

  //     if (!bestContour && contours.size() > 0) {
  //       bestContour = contours.get(0);
  //     }

  //     let point = null;
  //     if (bestContour) {
  //       // Find topmost point of best contour
  //       let topmost = null;
  //       let minY = Infinity;

  //       for (let i = 0; i < bestContour.total(); i++) {
  //         let x = bestContour.intPtr(i)[0];
  //         let y = bestContour.intPtr(i)[1];
  //         if (y < minY) {
  //           minY = y;
  //           topmost = { x, y };
  //         }
  //       }
  //       point = topmost;
  //     }

  //     // Clean up
  //     src.delete();
  //     hsv.delete();
  //     mask.delete();
  //     kernel.delete();
  //     contours.delete();
  //     hierarchy.delete();
  //     lower.delete();
  //     upper.delete();

  //     return point;
  //   } catch (error) {
  //     console.error("Enhanced fingertip detection error:", error);
  //     return null;
  //   }
  // };

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

      // Convert to HSV
      window.cv.cvtColor(src, src, window.cv.COLOR_RGBA2RGB);
      window.cv.cvtColor(src, hsv, window.cv.COLOR_RGB2HSV);

      // **IMPROVED SKIN COLOR DETECTION FOR ALL SKIN TONES**
      // Range 1: Light to medium skin tones (expanded range)
      let lower1 = new window.cv.Mat(
        hsv.rows,
        hsv.cols,
        hsv.type(),
        [0, 15, 50, 0]
      );
      let upper1 = new window.cv.Mat(
        hsv.rows,
        hsv.cols,
        hsv.type(),
        [25, 255, 255, 255]
      );
      let mask1 = new window.cv.Mat();
      window.cv.inRange(hsv, lower1, upper1, mask1);

      // Range 2: Reddish skin tones (upper hue range)
      let lower2 = new window.cv.Mat(
        hsv.rows,
        hsv.cols,
        hsv.type(),
        [160, 15, 50, 0]
      );
      let upper2 = new window.cv.Mat(
        hsv.rows,
        hsv.cols,
        hsv.type(),
        [180, 255, 255, 255]
      );
      let mask2 = new window.cv.Mat();
      window.cv.inRange(hsv, lower2, upper2, mask2);

      // Range 3: Darker skin tones (broader saturation and value ranges)
      let lower3 = new window.cv.Mat(
        hsv.rows,
        hsv.cols,
        hsv.type(),
        [5, 10, 30, 0]
      );
      let upper3 = new window.cv.Mat(
        hsv.rows,
        hsv.cols,
        hsv.type(),
        [30, 200, 200, 255]
      );
      let mask3 = new window.cv.Mat();
      window.cv.inRange(hsv, lower3, upper3, mask3);

      // Combine all masks for comprehensive skin detection
      let tempMask = new window.cv.Mat();
      window.cv.add(mask1, mask2, tempMask);
      window.cv.add(tempMask, mask3, mask);

      // Enhanced morphological operations for better noise reduction
      window.cv.morphologyEx(
        mask,
        mask,
        window.cv.MORPH_CLOSE,
        kernel,
        new window.cv.Point(-1, -1),
        3 // Increased iterations
      );
      window.cv.morphologyEx(
        mask,
        mask,
        window.cv.MORPH_OPEN,
        kernel,
        new window.cv.Point(-1, -1),
        2
      );

      // Apply Gaussian blur to reduce noise
      let blurredMask = new window.cv.Mat();
      window.cv.GaussianBlur(mask, blurredMask, new window.cv.Size(5, 5), 0);
      mask.delete();
      mask = blurredMask;

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

      // Rest of your contour analysis code remains the same...
      let bestContour = null;
      let maxScore = -1;

      for (let i = 0; i < contours.size(); i++) {
        let cnt = contours.get(i);
        let area = window.cv.contourArea(cnt);
        if (area < 300) continue; // Reduced minimum area for better detection

        let hull = new window.cv.Mat();
        window.cv.convexHull(cnt, hull, false, false);

        if (hull.total() > 3) {
          let defects = new window.cv.Mat();
          let hullIndices = new window.cv.Mat();
          window.cv.convexHull(cnt, hullIndices, false, true);
          window.cv.convexityDefects(cnt, hullIndices, defects);

          if (!defects.empty()) {
            if (defects.rows > maxScore) {
              maxScore = defects.rows;
              bestContour = cnt;
            }
          }

          hull.delete();
          hullIndices.delete();
          defects.delete();
        }
      }

      if (!bestContour && contours.size() > 0) {
        bestContour = contours.get(0);
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

      // Clean up all resources
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
      lower3.delete();
      upper3.delete();
      mask1.delete();
      mask2.delete();
      mask3.delete();
      tempMask.delete();

      return point;
    } catch (error) {
      console.error("Enhanced fingertip detection error:", error);
      return null;
    }
  };

  const STABLE_HOLD_DURATION = 2000;
  const ZONE_DEBOUNCE_TOLERANCE = 2000;

  const handleZoneDetection = (zoneName) => {
    const now = Date.now();

    if (zoneName === lastDetectedZoneRef.current) {
      const startTime = zoneStartTimeRef.current;
      if (startTime) {
        const elapsed = now - startTime;
        const percent = Math.min((elapsed / STABLE_HOLD_DURATION) * 100, 100);
        setProgressPercent(percent);

        if (elapsed >= STABLE_HOLD_DURATION) {
          setDetectedRegion(zoneName);
          handleSubmit(zoneName);
          zoneStartTimeRef.current = null;
          lastDetectedZoneRef.current = null;
          setCurrentZone(null);
          setProgressPercent(0);
        }
      }
    } else {
      const elapsedSinceLastZone = now - (zoneStartTimeRef.current || now + 1);

      if (
        lastDetectedZoneRef.current &&
        elapsedSinceLastZone < ZONE_DEBOUNCE_TOLERANCE
      ) {
        return;
      }

      lastDetectedZoneRef.current = zoneName;
      zoneStartTimeRef.current = zoneName ? now : null;
      setCurrentZone(zoneName);
      setProgressPercent(0);
    }
  };

  const handleSubmit = async (detectedRegion) => {
    try {
      setIsProcessing(true);

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

      window.location.replace(
        `/eating-habit/selection/result?qrId=${currentQrId}&region=${detectedRegion}`
      );
    } catch (err) {
      let errorMessage = "Submission failed. Please try again.";
      if (err?.message) {
        errorMessage += `\n\nError: ${err.message}`;
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

        // Always hide pointer first
        if (pointerRef.current) {
          pointerRef.current.style.display = "none";
        }

        if (
          results.multiHandLandmarks &&
          results.multiHandLandmarks.length > 0
        ) {
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
          }
        } else {
          handDetectionFailCount.current++;
          setWarningMessage(
            `Trying fallback detection (${handDetectionFailCount.current}/4)`
          );

          // Reduce threshold from 3 to 2 for faster fallback
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
                  // Add boundary check
                  if (
                    detectedTip.x > 10 &&
                    detectedTip.y > 10 &&
                    detectedTip.x < canvas.width - 10 &&
                    detectedTip.y < canvas.height - 10
                  ) {
                    fingerTip = detectedTip;
                    setWarningMessage("Fingertip mode active");
                  }
                } else {
                  setWarningMessage("No fingertip detected");
                }
              } catch (error) {
                console.error("Error in fingertip detection:", error);
                setWarningMessage("Fingertip detection error");
              }
            }
          }
        }

        // Rest of your detection logic remains the same...
        if (fingerTip) {
          const { x, y } = fingerTip;
          const corners = posterCornersRef.current;

          let detected = null;
          let displayX = x;
          let displayY = y;

          if (corners.length === 4 && window.cv) {
            try {
              const srcCorners = corners.map((pt) => [pt.x, pt.y]);
              const dstCorners = [
                [0, 0],
                [1, 0],
                [1, 1],
                [0, 1],
              ];

              const M = getPerspectiveTransformMatrix(srcCorners, dstCorners);
              if (M) {
                const fingerPosterSpace = warpPoint(M, { x, y });

                // Convert normalized coordinates back to display coordinates for pointer
                displayX = fingerPosterSpace.x * 1517;
                displayY = fingerPosterSpace.y * 2200;

                // Check zones using normalized coordinates
                for (const [zoneName, zone] of Object.entries(
                  normalizedZones
                )) {
                  if (pointInNormalizedZone(fingerPosterSpace, zone)) {
                    detected = zoneName;
                    break;
                  }
                }

                // Show debug info on mobile screen
                showDebugInfo(fingerPosterSpace, detected);

                M.delete(); // Clean up OpenCV matrix
              }
            } catch (e) {
              console.warn("OpenCV error:", e);
              displayX = x;
              displayY = y;
            }
          }

          // Show pointer at calculated position
          requestAnimationFrame(() => {
            if (
              pointerRef.current &&
              displayX >= 0 &&
              displayY >= 0 &&
              displayX <= 1517 &&
              displayY <= 2200
            ) {
              pointerRef.current.style.display = "block";
              pointerRef.current.style.left = `${displayX}px`;
              pointerRef.current.style.top = `${displayY}px`;
            }
          });

          if (resultRef.current) {
            resultRef.current.textContent = detected
              ? `Detected: ${detected} (${detectionMode} mode)`
              : "Point to select your eating style";
          }

          handleZoneDetection(detected);
        } else {
          // Clear debug info when no finger detected
          const debugDiv = document.getElementById("debug-info");
          if (debugDiv) {
            debugDiv.innerHTML = "";
          }

          if (resultRef.current) {
            resultRef.current.textContent = posterInView
              ? "No finger detected"
              : "Show all 4 markers";
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

        const matchedMarkers = markers.filter((marker) =>
          isInCorner(marker, marker.id)
        );

        const matchedIds = matchedMarkers.map((m) => m.id).sort();

        if (matchedIds.length === 4) {
          const markerMap = {};
          matchedMarkers.forEach((marker) => {
            markerMap[marker.id] = marker;
          });

          const roiPolygon = [
            markerMap[2]?.corners[1], // top-left
            markerMap[13]?.corners[1], // top-right
            markerMap[3]?.corners[1], // bottom-right
            markerMap[6]?.corners[1], // bottom-left
          ].filter(Boolean);

          if (roiPolygon.length === 4) {
            posterCornersRef.current = roiPolygon.map((pt) => ({
              x: pt.x,
              y: pt.y,
            }));
          }
        }

        // if (!hasBeenAligned.current && matchedIds.length === 4) {
        //   hasBeenAligned.current = true;
        //   console.log("Poster aligned!");
        // }

        if (!hasBeenAligned.current && matchedIds.length === 4) {
          hasBeenAligned.current = true;
          console.log("Poster aligned!");

          // Call zone visualization AFTER poster is aligned
          setTimeout(() => {
            drawZoneOverlays();
          }, 1000);
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

  // Rest of your JSX remains the same
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center p-4 bg-[#f3e8d4] h-[100dvh]">
      <h1 className="text-2xl font-bold text-[#046a81] mb-4">Scanner</h1>

      <div
        className="wrapper relative bg-black overflow-hidden"
        style={{
          width: "100vw",
          height: "calc(100vw * 2200 / 1517)",
          maxHeight: "100vh",
          maxWidth: "calc(100vh * 1517 / 2200)",
        }}
      >
        {/* <div
          id="container"
          ref={containerRef}
          className="absolute inset-0"
          style={{
            width: "1517px",
            height: "2200px",
            transformOrigin: "top left",
          }}
        >
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          /> */}
        <div
          id="container"
          ref={containerRef}
          className="absolute inset-0 overflow-hidden"
          style={{
            width: "1517px",
            height: "2200px",
            transformOrigin: "top left",
          }}
        >
          <div
            className="absolute"
            style={{
              top: "-150px", // shift camera upward to show more below
              left: "0px",
              width: "1517px",
              height: "2500px", // taller than poster to show more bottom
            }}
          >
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
          </div>

          {/* Add this debug display */}
          <div
            id="debug-info"
            className="absolute top-4 left-4 z-30 max-w-xs"
            style={{ pointerEvents: "none" }}
          ></div>

          <canvas
            ref={canvasRef}
            width={1517}
            height={2200}
            className="absolute inset-0 hidden"
          />

          <canvas
            ref={maskCanvasRef}
            className="absolute top-0 left-0 w-full h-full pointer-events-none z-20"
          />

          <canvas ref={detectionCanvasRef} className="hidden" />

          {posterInView && progressPercent > 0 && (
            // <div className="absolute top-6 right-6 z-20">
            <div className="absolute bottom-1/3 left-1/2 transform -translate-x-1/2 z-20">
              <svg className="w-[200px] h-[200px] rotate-[-90deg]">
                <circle
                  cx="50%"
                  cy="50%"
                  r="70" // Increase radius from 44 to 60
                  stroke="#e0f2f1"
                  strokeWidth="10" // Slightly thicker background
                  fill="none"
                />
                <circle
                  cx="50%"
                  cy="50%"
                  r="70" // Increase radius from 44 to 60
                  stroke="#14b8a6"
                  strokeWidth="20" // Thicker progress stroke
                  strokeDasharray={2 * Math.PI * 70} // Update to match new radius
                  strokeDashoffset={
                    ((100 - progressPercent) / 100) * (2 * Math.PI * 70) // Update calculation
                  }
                  strokeLinecap="round"
                  fill="none"
                />
              </svg>
              <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-3xl font-bold text-teal-700">
                {Math.floor((progressPercent / 100) * 2)}s
              </span>
            </div>
          )}

          <div
            ref={pointerRef}
            className={`absolute w-8 h-8 rounded-full border-2 border-white pointer-events-none hidden transform -translate-x-1/2 -translate-y-1/2 ${
              detectionMode === "hand" ? "bg-green-500" : "bg-orange-500"
            } bg-opacity-70`}
          />

          <div
            ref={resultRef}
            className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-80 text-white px-4 py-2 rounded-lg text-lg font-medium max-w-xs text-center"
          >
            Loading...
          </div>

          {warningMessage && (
            <div className="absolute bottom-16 left-1/2 transform -translate-x-1/2 bg-orange-100 border border-orange-300 text-orange-800 px-3 py-2 rounded-lg text-lg font-medium max-w-xs text-center">
              ⚠️ {warningMessage}
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 w-full">
        {posterInView ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-3">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <div>
              <p className="text-green-800 font-medium text-sm">
                Poster aligned
              </p>
              <p className="text-green-600 text-xs">
                Point to select your eating style
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 flex items-center gap-3">
            <div className="w-3 h-3 bg-orange-500 rounded-full animate-pulse"></div>
            <div>
              <p className="text-orange-800 font-medium text-sm">
                Aligning poster...
              </p>
              <p className="text-orange-600 text-xs">Show all 4 markers</p>
            </div>
          </div>
        )}
      </div>

      {showToast && detectedRegion && zoneInfo[detectedRegion] && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-2xl">
            <div className="text-center mb-4">
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
                onClick={() => handleSubmit(detectedRegion)}
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

// /* Integrated BMI Pointer with ArUco Markers + Hand/Fingertip Detection - Tailwind Version */
// import React, { useEffect, useRef, useState } from "react";
// import { Hands } from "@mediapipe/hands";
// import { apiUtils, deviceIdManager } from "../utils/deviceId";

// // const zones = {
// //   distracted: [
// //     [703, 671],
// //     [1622, 652],
// //     [1628, 1312],
// //     [823, 1328],
// //   ],
// //   hurry: [
// //     [82, 1125],
// //     [748, 1133],
// //     [740, 1850],
// //     [66, 1860],
// //   ],
// //   mindfully: [
// //     [852, 1534],
// //     [1620, 1531],
// //     [1633, 2186],
// //     [802, 2192],
// //   ],
// // };
// const normalizedZones = {
//   distracted: [
//     [0.463, 0.305],
//     [1, 0.296],
//     [1, 0.596],
//     [0.542, 0.603],
//   ],
//   hurry: [
//     [0.043, 0.511],
//     [0.493, 0.515],
//     [0.488, 0.84],
//     [0.039, 0.845],
//   ],
//   mindfully: [
//     [0.561, 0.697],
//     [1, 0.695],
//     [1, 1],
//     [0.529, 1],
//   ],
// };

// const zoneInfo = {
//   hurry: {
//     title: "I eat in a hurry",
//     videoUrl: "/videos/hurry.mp4",
//   },
//   mindfully: {
//     title: "I eat mindfully",
//     videoUrl: "/videos/mindfully.mp4",
//   },
//   distracted: {
//     title: "I eat while distracted",
//     videoUrl: "/videos/distracted.mp4",
//   },
// };

// const BMISelectionAppTailwind = () => {
//   const videoRef = useRef(null);
//   const canvasRef = useRef(null);
//   const pointerRef = useRef(null);
//   const resultRef = useRef(null);
//   const containerRef = useRef(null);
//   const detectionCanvasRef = useRef(null);

//   const [posterInView, setPosterInView] = useState(false);
//   const [warningMessage, setWarningMessage] = useState("Initializing...");
//   const [detectionMode, setDetectionMode] = useState("hand");
//   const [currentZone, setCurrentZone] = useState(null);
//   const [qrId, setQrId] = useState(null);
//   const [showToast, setShowToast] = useState(false);
//   const [detectedRegion, setDetectedRegion] = useState(null);
//   const [isProcessing, setIsProcessing] = useState(false);
//   const [progressPercent, setProgressPercent] = useState(0);

//   const lastDetectedIdsRef = useRef([]);
//   const hasBeenAligned = useRef(false);
//   const handsRef = useRef(null);
//   const handDetectionFailCount = useRef(0);
//   const zoneTimeoutRef = useRef(null);
//   const zoneStartTimeRef = useRef(null);
//   const lastDetectedZoneRef = useRef(null);
//   const posterCornersRef = useRef([]);
//   const maskCanvasRef = useRef(null);

//   const cornerZones = {
//     2: { x: 200, y: 50 },
//     13: { x: 480, y: 50 },
//     6: { x: 190, y: 450 },
//     3: { x: 480, y: 450 },
//   };

//   const BUFFER = 170;

//   function isInCorner(marker, id) {
//     const expected = cornerZones[id];
//     if (!expected || !marker?.corners) return false;

//     const cx = marker.corners.reduce((sum, pt) => sum + pt.x, 0) / 4;
//     const cy = marker.corners.reduce((sum, pt) => sum + pt.y, 0) / 4;

//     const inCorner =
//       Math.abs(cx - expected.x) < BUFFER && Math.abs(cy - expected.y) < BUFFER;

//     console.log(
//       `Marker ${id} center: (${Math.round(cx)}, ${Math.round(
//         cy
//       )}), expected: (${expected.x}, ${expected.y}), match: ${inCorner}`
//     );

//     return inCorner;
//   }

// function getPerspectiveTransformMatrix(src, dst) {
//   const cv = window.cv;
//   const srcMat = cv.matFromArray(4, 1, cv.CV_32FC2, src.flat());
//   const dstMat = cv.matFromArray(4, 1, cv.CV_32FC2, dst.flat());
//   const M = cv.getPerspectiveTransform(srcMat, dstMat);
//   srcMat.delete();
//   dstMat.delete();
//   return M;
// }

// function warpPoint(matrix, point) {
//   const cv = window.cv;
//   const src = cv.matFromArray(1, 1, cv.CV_32FC2, [point.x, point.y]);
//   const dst = new cv.Mat();
//   cv.perspectiveTransform(src, dst, matrix);
//   const result = dst.data32F;
//   src.delete();
//   dst.delete();
//   return { x: result[0], y: result[1] };
// }

// function pointInNormalizedZone(pt, zone) {
//   let inside = false;
//   for (let i = 0, j = zone.length - 1; i < zone.length; j = i++) {
//     const [xi, yi] = zone[i];
//     const [xj, yj] = zone[j];
//     const intersect =
//       yi > pt.y !== yj > pt.y &&
//       pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi) + xi;
//     if (intersect) inside = !inside;
//   }
//   return inside;
// }

//   // RGB to HSV conversion function
//   const rgbToHsv = (r, g, b) => {
//     const max = Math.max(r, g, b);
//     const min = Math.min(r, g, b);
//     const diff = max - min;

//     let h = 0;
//     let s = 0;
//     const v = max;

//     if (diff !== 0) {
//       s = diff / max;

//       switch (max) {
//         case r:
//           h = ((g - b) / diff) % 6;
//           break;
//         case g:
//           h = (b - r) / diff + 2;
//           break;
//         case b:
//           h = (r - g) / diff + 4;
//           break;
//       }
//       h = h * 60;
//       if (h < 0) h += 360;
//     }

//     return [h, s, v];
//   };

//   const drawPosterMask = (canvasWidth, canvasHeight) => {
//     const maskCanvas = maskCanvasRef.current;
//     const corners = posterCornersRef.current;

//     if (!maskCanvas || corners.length !== 4) return;

//     const ctx = maskCanvas.getContext("2d");
//     maskCanvas.width = canvasWidth;
//     maskCanvas.height = canvasHeight;

//     ctx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);

//     // Darken the full canvas
//     ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
//     ctx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);

//     // Cut out ROI polygon
//     ctx.globalCompositeOperation = "destination-out";
//     ctx.beginPath();
//     ctx.moveTo(corners[0].x, corners[0].y);
//     for (let i = 1; i < corners.length; i++) {
//       ctx.lineTo(corners[i].x, corners[i].y);
//     }
//     ctx.closePath();
//     ctx.fill();

//     // Reset for future drawing
//     ctx.globalCompositeOperation = "source-over";
//   };

//   // Fingertip detection using contours
//   const detectFingertipFromContours = (imageData, width, height) => {
//     try {
//       const canvas = detectionCanvasRef.current;
//       if (!canvas) return null;

//       const ctx = canvas.getContext("2d");
//       canvas.width = width;
//       canvas.height = height;

//       ctx.putImageData(imageData, 0, 0);

//       const data = imageData.data;
//       const skinMask = new Uint8ClampedArray(width * height);

//       for (let i = 0; i < data.length; i += 4) {
//         const r = data[i] / 255.0;
//         const g = data[i + 1] / 255.0;
//         const b = data[i + 2] / 255.0;

//         const hsv = rgbToHsv(r, g, b);
//         const h = hsv[0];
//         const s = hsv[1];
//         const v = hsv[2];

//         const isSkin =
//           h >= 0 &&
//           h <= 20 &&
//           s >= 48 / 255 &&
//           s <= 1.0 &&
//           v >= 80 / 255 &&
//           v <= 1.0;

//         skinMask[Math.floor(i / 4)] = isSkin ? 255 : 0;
//       }

//       const contours = findContours(skinMask, width, height);

//       if (contours.length === 0) return null;

//       let largestContour = contours[0];
//       let maxArea = contourArea(largestContour);

//       for (let i = 1; i < contours.length; i++) {
//         const area = contourArea(contours[i]);
//         if (area > maxArea && area > 700) {
//           maxArea = area;
//           largestContour = contours[i];
//         }
//       }

//       if (maxArea < 500) return null;

//       let topmost = largestContour[0];
//       for (const point of largestContour) {
//         if (point.y < topmost.y) {
//           topmost = point;
//         }
//       }

//       // return {
//       //   x: (topmost.x / width) * 1517,
//       //   y: (topmost.y / height) * 2200,
//       // };
//       return {
//         x: (topmost.x / width) * canvas.width,
//         y: (topmost.y / height) * canvas.height,
//       };
//     } catch (error) {
//       console.error("Fingertip detection error:", error);
//       return null;
//     }
//   };

//   const findContours = (mask, width, height) => {
//     const contours = [];
//     const visited = new Array(width * height).fill(false);

//     for (let y = 1; y < height - 1; y++) {
//       for (let x = 1; x < width - 1; x++) {
//         const idx = y * width + x;
//         if (mask[idx] === 255 && !visited[idx]) {
//           const contour = traceContour(mask, width, height, x, y, visited);
//           if (contour.length > 10) {
//             contours.push(contour);
//           }
//         }
//       }
//     }

//     return contours;
//   };

//   const traceContour = (mask, width, height, startX, startY, visited) => {
//     const contour = [];
//     const stack = [{ x: startX, y: startY }];

//     while (stack.length > 0) {
//       const { x, y } = stack.pop();
//       const idx = y * width + x;

//       if (
//         x < 0 ||
//         x >= width ||
//         y < 0 ||
//         y >= height ||
//         visited[idx] ||
//         mask[idx] !== 255
//       ) {
//         continue;
//       }

//       visited[idx] = true;
//       contour.push({ x, y });

//       for (let dy = -1; dy <= 1; dy++) {
//         for (let dx = -1; dx <= 1; dx++) {
//           if (dx === 0 && dy === 0) continue;
//           stack.push({ x: x + dx, y: y + dy });
//         }
//       }
//     }

//     return contour;
//   };

//   const contourArea = (contour) => {
//     if (contour.length < 3) return 0;

//     let area = 0;
//     for (let i = 0; i < contour.length; i++) {
//       const j = (i + 1) % contour.length;
//       area += contour[i].x * contour[j].y;
//       area -= contour[j].x * contour[i].y;
//     }
//     return Math.abs(area) / 2;
//   };

//   // const handleZoneDetection = (zoneName) => {
//   //   if (zoneName !== currentZone) {
//   //     setCurrentZone(zoneName);

//   //     if (zoneTimeoutRef.current) clearTimeout(zoneTimeoutRef.current);

//   //     zoneTimeoutRef.current = setTimeout(() => {
//   //       if (zoneName && zoneInfo[zoneName]) {
//   //         setDetectedRegion(zoneName);
//   //         // setShowToast(true);
//   //         handleSubmit(zoneName);
//   //       }
//   //     }, 300);
//   //   }
//   // };

//   const isPointInPolygon = (x, y, polygon) => {
//     let inside = false;
//     for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
//       const xi = polygon[i].x,
//         yi = polygon[i].y;
//       const xj = polygon[j].x,
//         yj = polygon[j].y;

//       const intersect =
//         yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
//       if (intersect) inside = !inside;
//     }
//     return inside;
//   };

//   const STABLE_HOLD_DURATION = 1000; // 3 seconds
//   const ZONE_DEBOUNCE_TOLERANCE = 1000; // 1 sec grace period

//   const handleZoneDetection = (zoneName) => {
//     const now = Date.now();

//     if (
//       zoneName === lastDetectedZoneRef.current ||
//       (zoneName &&
//         lastDetectedZoneRef.current &&
//         zoneName === lastDetectedZoneRef.current)
//     ) {
//       // Still pointing to same zone
//       const startTime = zoneStartTimeRef.current;
//       if (startTime) {
//         const elapsed = now - startTime;
//         const percent = Math.min((elapsed / STABLE_HOLD_DURATION) * 100, 100);
//         setProgressPercent(percent);

//         if (elapsed >= STABLE_HOLD_DURATION) {
//           setDetectedRegion(zoneName);
//           handleSubmit(zoneName);
//           zoneStartTimeRef.current = null;
//           lastDetectedZoneRef.current = null;
//           setCurrentZone(null);
//           setProgressPercent(0);
//         }
//       }
//     } else {
//       // If briefly lost zone (< tolerance), ignore the reset
//       const elapsedSinceLastZone = now - (zoneStartTimeRef.current || now + 1); // prevent negative

//       if (
//         lastDetectedZoneRef.current &&
//         elapsedSinceLastZone < ZONE_DEBOUNCE_TOLERANCE
//       ) {
//         // Still consider same zone
//         console.log(
//           "Small flicker, keeping last zone:",
//           lastDetectedZoneRef.current
//         );
//         return;
//       }

//       // Fully new zone
//       lastDetectedZoneRef.current = zoneName;
//       zoneStartTimeRef.current = zoneName ? now : null;
//       setCurrentZone(zoneName);
//       setProgressPercent(0);
//     }
//   };

//   const handleSubmit = async (detectedRegion) => {
//     try {
//       setIsProcessing(true);

//       // Get qrId from URL parameters
//       const urlParams = new URLSearchParams(window.location.search);
//       const currentQrId = urlParams.get("qrId");

//       if (!currentQrId || !detectedRegion) {
//         alert(
//           "Missing QR ID or Region.\n\nqrId: " +
//             currentQrId +
//             "\nregion: " +
//             detectedRegion
//         );
//         return;
//       }

//       // await apiUtils.post("/selection/store", {
//       //   qrId: currentQrId,
//       //   selection: detectedRegion,
//       // });

//       // window.location.href = `/eating-habit/selection/result?qrId=${currentQrId}&region=${detectedRegion}`;
//       window.location.replace(
//         `/eating-habit/selection/result?qrId=${currentQrId}&region=${detectedRegion}`
//       );
//     } catch (err) {
//       let errorMessage = "Submission failed. Please try again.";
//       if (err?.message) {
//         errorMessage += `\n\nError: ${err.message}`;
//       } else if (typeof err === "string") {
//         errorMessage += `\n\nError: ${err}`;
//       } else {
//         errorMessage += `\n\nAn unknown error occurred.`;
//       }
//       alert(errorMessage);
//     } finally {
//       setIsProcessing(false);
//     }
//   };

//   const handleRetry = () => {
//     setShowToast(false);
//     setDetectedRegion(null);
//     setCurrentZone(null);
//   };

//   const isPointInZone = (point, zone, buffer = 50) => {
//     const [x, y] = point;

//     // Create a smaller zone by adding buffer inward from all edges
//     const bufferedZone = [];
//     const centerX = zone.reduce((sum, pt) => sum + pt[0], 0) / zone.length;
//     const centerY = zone.reduce((sum, pt) => sum + pt[1], 0) / zone.length;

//     for (let i = 0; i < zone.length; i++) {
//       const [zx, zy] = zone[i];
//       // Move each point toward the center by buffer amount
//       const dx = centerX - zx;
//       const dy = centerY - zy;
//       const distance = Math.sqrt(dx * dx + dy * dy);

//       if (distance > buffer) {
//         const ratio = (distance - buffer) / distance;
//         bufferedZone.push([centerX - dx * ratio, centerY - dy * ratio]);
//       } else {
//         // If buffer is too large, use original point
//         bufferedZone.push([zx, zy]);
//       }
//     }

//     // Check if point is inside the buffered (smaller) zone
//     let inside = false;
//     for (
//       let i = 0, j = bufferedZone.length - 1;
//       i < bufferedZone.length;
//       j = i++
//     ) {
//       const [xi, yi] = bufferedZone[i];
//       const [xj, yj] = bufferedZone[j];
//       const intersect =
//         yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
//       if (intersect) inside = !inside;
//     }
//     return inside;
//   };

//   useEffect(() => {
//     const urlParams = new URLSearchParams(window.location.search);
//     setQrId(urlParams.get("qrId"));

//     // const isPointInZone = (point, zone, buffer = 80) => {
//     //   const [x, y] = point;

//     //   // Create a smaller zone by adding buffer inward from all edges
//     //   const bufferedZone = [];
//     //   const centerX = zone.reduce((sum, pt) => sum + pt[0], 0) / zone.length;
//     //   const centerY = zone.reduce((sum, pt) => sum + pt[1], 0) / zone.length;

//     //   for (let i = 0; i < zone.length; i++) {
//     //     const [zx, zy] = zone[i];
//     //     // Move each point toward the center by buffer amount
//     //     const dx = centerX - zx;
//     //     const dy = centerY - zy;
//     //     const distance = Math.sqrt(dx * dx + dy * dy);

//     //     if (distance > buffer) {
//     //       const ratio = (distance - buffer) / distance;
//     //       bufferedZone.push([centerX - dx * ratio, centerY - dy * ratio]);
//     //     } else {
//     //       // If buffer is too large, use original point
//     //       bufferedZone.push([zx, zy]);
//     //     }
//     //   }

//     //   // Check if point is inside the buffered (smaller) zone
//     //   let inside = false;
//     //   for (
//     //     let i = 0, j = bufferedZone.length - 1;
//     //     i < bufferedZone.length;
//     //     j = i++
//     //   ) {
//     //     const [xi, yi] = bufferedZone[i];
//     //     const [xj, yj] = bufferedZone[j];
//     //     const intersect =
//     //       yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
//     //     if (intersect) inside = !inside;
//     //   }
//     //   return inside;
//     // };

//     const startCamera = async () => {
//       let stream = null;
//       let constraints = { video: { facingMode: { exact: "environment" } } };

//       try {
//         stream = await navigator.mediaDevices.getUserMedia(constraints);
//       } catch (err) {
//         constraints.video.facingMode = { ideal: "environment" };
//         try {
//           stream = await navigator.mediaDevices.getUserMedia(constraints);
//         } catch (err2) {
//           stream = await navigator.mediaDevices.getUserMedia({ video: true });
//         }
//       }

//       if (videoRef.current) {
//         videoRef.current.srcObject = stream;
//       }

//       if (videoRef.current && canvasRef.current) {
//         videoRef.current.onloadeddata = () => {
//           const video = videoRef.current;
//           const canvas = canvasRef.current;

//           // Ensure canvas matches the video stream size
//           canvas.width = video.videoWidth;
//           canvas.height = video.videoHeight;
//         };
//       }

//       return new Promise((resolve) => {
//         videoRef.current.onloadedmetadata = () => {
//           resolve(videoRef.current);
//         };
//       });
//     };

//     startCamera().then(() => {
//       const hands = new Hands({
//         locateFile: (file) =>
//           `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
//       });

//       hands.setOptions({
//         maxNumHands: 1,
//         modelComplexity: 0,
//         minDetectionConfidence: 0.8,
//         minTrackingConfidence: 0.8,
//       });

//       handsRef.current = hands;

//       hands.onResults((results) => {
//         let fingerTip = null;

//         if (
//           results.multiHandLandmarks &&
//           results.multiHandLandmarks.length > 0
//         ) {
//           const indexTip = results.multiHandLandmarks[0][8];
//           setWarningMessage(`👆 Tip detected at (${indexTip.x.toFixed(2)}, ${indexTip.y.toFixed(2)})`);
//           fingerTip = {
//             x: indexTip.x * canvas.width,
//             y: indexTip.y * canvas.height,
//           };
//           handDetectionFailCount.current = 0;
//           setDetectionMode("hand");
//         } else {
//           handDetectionFailCount.current++;
// setWarningMessage("🚫 No hand detected");
//           if (handDetectionFailCount.current > 3) {
//             setDetectionMode("fingertip");

//             const canvas = canvasRef.current;
//             const video = videoRef.current;
//             if (canvas && video) {
//               const ctx = canvas.getContext("2d");
//               ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

//               try {
//                 const imageData = ctx.getImageData(
//                   0,
//                   0,
//                   canvas.width,
//                   canvas.height
//                 );
//                 const detectedTip = detectFingertipFromContours(
//                   imageData,
//                   canvas.width,
//                   canvas.height
//                 );
//                 if (
//                   detectedTip &&
//                   detectedTip.x > 10 &&
//                   detectedTip.y > 10 &&
//                   detectedTip.x < canvas.width - 10 &&
//                   detectedTip.y < canvas.height - 10
//                 ) {
//                   fingerTip = detectedTip;
//                 }
//               } catch (error) {
//                 console.error("Error in fingertip detection:", error);
//                 setWarningMessage("🚫 No hand detected2");
//               }
//             }
//           }
//         }

//         if (fingerTip) {
//         //   const { x, y } = fingerTip;

//         //   const corners = posterCornersRef.current;
//         //   if (corners.length === 4) {
//         //     const insidePoster = isPointInPolygon(x, y, corners);

//         //     // if (!insidePoster) {
//         //     //   if (pointerRef.current) {
//         //     //     pointerRef.current.style.display = "none";
//         //     //   }
//         //     //   if (resultRef.current) {
//         //     //     resultRef.current.textContent = "Keep hand within poster area";
//         //     //   }
//         //     //   handleZoneDetection(null);
//         //     //   return;
//         //     // }
//         //   }

//         //   if (pointerRef.current) {
//         //     pointerRef.current.style.display = "block";
//         //     pointerRef.current.style.left = `${x}px`;
//         //     pointerRef.current.style.top = `${y}px`;
//         //   }

//         //   let detected = null;
//         //   for (const [zoneName, zone] of Object.entries(zones)) {
//         //     if (isPointInZone([x, y], zone)) {
//         //       detected = zoneName;
//         //       break;
//         //     }
//         //   }

//         //   if (resultRef.current) {
//         //     resultRef.current.textContent = detected
//         //       ? `Detected: ${detected} (${detectionMode} mode)`
//         //       : "Point to select your eating style";
//         //   }

//         //   handleZoneDetection(detected);
//         //   setWarningMessage("");
//         // }
//         const { x, y } = fingerTip;
// const corners = posterCornersRef.current;

// if (corners.length === 4) {
//   const srcCorners = corners.map((pt) => [pt.x, pt.y]);
//   const dstCorners = [
//     [0, 0], // top-left
//     [1, 0], // top-right
//     [1, 1], // bottom-right
//     [0, 1], // bottom-left
//   ];
//  try{const M = getPerspectiveTransformMatrix(srcCorners, dstCorners);
//   const fingerPosterSpace = warpPoint(M, { x, y }); // gives x, y in [0–1]

//   let detected = null;
//   for (const [zoneName, zone] of Object.entries(normalizedZones)) {
//     if (pointInNormalizedZone(fingerPosterSpace, zone)) {
//       detected = zoneName;
//       break;
//     }
//   }}catch(e){
//       console.warn("OpenCV error:", e);

//   }

//   if (resultRef.current) {
//     resultRef.current.textContent = detected
//       ? `Detected: ${detected} (${detectionMode} mode)`
//       : "Point to select your eating style";
//   }

//   handleZoneDetection(detected);
// }}
//  else {
//           if (pointerRef.current) {
//             pointerRef.current.style.display = "none";
//           }
//           if (resultRef.current) {
//             resultRef.current.textContent = posterInView
//               ? "No finger detected"
//               : "Show all 4 markers";
//           }
//           if (posterInView) {
//             setWarningMessage(
//               "👆 Hand not detected. Keep your index finger visible."
//             );
//           } else {
//             setWarningMessage("");
//           }
//           handleZoneDetection(null);
//         }
//       });

//       const detector = new window.AR.Detector();

//       const detectLoop = async () => {
//         const video = videoRef.current;
//         const canvas = canvasRef.current;
//         if (!video || !canvas) return;

//         const ctx = canvas.getContext("2d", { willReadFrequently: true });
//         canvas.width = video.videoWidth;
//         canvas.height = video.videoHeight;
//         ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

//         const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
//         const markers = detector.detect(imageData);

//         if (markers.length > 0) {
//           console.log("Detected marker(s):");
//           markers.forEach((marker) => {
//             const cx = marker.corners.reduce((sum, pt) => sum + pt.x, 0) / 4;
//             const cy = marker.corners.reduce((sum, pt) => sum + pt.y, 0) / 4;
//             console.log(
//               `  ↳ Marker ${marker.id} center: (${Math.round(cx)}, ${Math.round(
//                 cy
//               )})`
//             );
//           });
//         }

//         const detectedIds = markers.map((m) => m.id).sort();

//         const matchedMarkers = markers.filter((marker) =>
//           isInCorner(marker, marker.id)
//         );

//         const matchedIds = matchedMarkers.map((m) => m.id).sort();

//         // Sort corners in consistent order (top-left, top-right, bottom-right, bottom-left)
//         const corners = matchedMarkers.map((m) => {
//           const cx = m.corners.reduce((sum, pt) => sum + pt.x, 0) / 4;
//           const cy = m.corners.reduce((sum, pt) => sum + pt.y, 0) / 4;
//           return { id: m.id, cx, cy };
//         });

//         posterCornersRef.current = corners;

//         //
//         if (matchedIds.length === 4) {
//           const markerMap = {};
//           matchedMarkers.forEach((marker) => {
//             markerMap[marker.id] = marker;
//           });

//           const roiPolygon = [
//             markerMap[2]?.corners[1],
//             markerMap[13]?.corners[1],
//             markerMap[3]?.corners[1],
//             markerMap[6]?.corners[1],
//           ].filter(Boolean); // Only include if marker is detected

//           if (roiPolygon.length === 4) {
//             posterCornersRef.current = roiPolygon.map((pt) => ({
//               x: pt.x,
//               y: pt.y,
//             }));
//           }
//         }

//         // drawPosterMask(canvas.width, canvas.height);

//         const lastDetected = lastDetectedIdsRef.current.join(",");
//         const currentDetected = matchedIds.join(",");

//         if (lastDetected !== currentDetected) {
//           console.log(" Marker IDs changed:", matchedIds);
//           lastDetectedIdsRef.current = matchedIds;
//         }

//         if (!hasBeenAligned.current && matchedIds.length === 4) {
//           hasBeenAligned.current = true;
//           console.log("Poster aligned!");
//         }

//         const visible = hasBeenAligned.current
//           ? matchedIds.length >= 3
//           : matchedIds.length === 4;

//         setPosterInView(visible);

//         if (matchedIds.length > 0) {
//           setWarningMessage(`Markers visible: ${matchedIds.join(", ")}`);
//         } else {
//           setWarningMessage("No markers detected");
//         }

//         if (visible) {
//           await hands.send({ image: video });
//           setWarningMessage("");
//         } else {
//           if (pointerRef.current) {
//             pointerRef.current.style.display = "none";
//           }
//           if (resultRef.current) {
//             resultRef.current.textContent = "Align poster with 4 markers";
//           }
//           //   setWarningMessage("📄Poster not aligned. Show all 4 ArUco markers.");
//           handleZoneDetection(null);
//         }

//         requestAnimationFrame(detectLoop);
//       };

//       const scaleContainer = () => {
//         const wrapper = containerRef.current?.parentElement;
//         if (!wrapper || !containerRef.current) return;

//         const scaleX = wrapper.clientWidth / 1517;
//         const scaleY = wrapper.clientHeight / 2200;
//         containerRef.current.style.transform = `scale(${scaleX}, ${scaleY})`;
//       };

//       scaleContainer();
//       window.addEventListener("resize", scaleContainer);
//       detectLoop();
//     });
//   }, []);

//   return (
//     <div className="fixed inset-0 flex flex-col items-center justify-center p-4 bg-[#f3e8d4] h-[100dvh]">
//       <h1 className="text-2xl font-bold text-[#046a81] mb-4">Scanner</h1>

//       <div
//         className="wrapper relative bg-black overflow-hidden"
//         style={{
//           width: "100vw",
//           height: "calc(100vw * 2200 / 1517)",
//           maxHeight: "100vh",
//           maxWidth: "calc(100vh * 1517 / 2200)",
//           // margin: "auto",
//         }}
//       >
//         <div
//           id="container"
//           ref={containerRef}
//           className="absolute inset-0"
//           style={{
//             width: "1517px",
//             height: "2200px",
//             transformOrigin: "top left",
//           }}
//         >
//           {/* Video Element */}
//           <video
//             ref={videoRef}
//             autoPlay
//             playsInline
//             className="w-full h-full object-cover"
//           />

//           {/* Hidden Canvas Elements */}
//           <canvas
//             ref={canvasRef}
//             width={1517}
//             height={2200}
//             className="absolute inset-0 hidden"
//           />

//           <canvas
//             ref={maskCanvasRef}
//             className="absolute top-0 left-0 w-full h-full pointer-events-none z-20"
//           />

//           <canvas ref={detectionCanvasRef} className="hidden" />

//           {posterInView && progressPercent > 0 && (
//             <div className="absolute top-6 right-6 z-20">
//               <svg className="w-[136px] h-[136px] rotate-[-90deg]">
//                 <circle
//                   cx="50%"
//                   cy="50%"
//                   r="44"
//                   stroke="#e0f2f1" // Light teal background ring
//                   strokeWidth="6"
//                   fill="none"
//                 />
//                 <circle
//                   cx="50%"
//                   cy="50%"
//                   r="44"
//                   stroke="#14b8a6" // Teal-500 progress
//                   strokeWidth="15"
//                   strokeDasharray={2 * Math.PI * 44}
//                   strokeDashoffset={
//                     ((100 - progressPercent) / 100) * (2 * Math.PI * 44)
//                   }
//                   strokeLinecap="round"
//                   fill="none"
//                 />
//               </svg>
//               <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-xl font-semibold text-teal-700">
//                 {Math.floor((progressPercent / 100) * 3)}s
//               </span>
//             </div>
//           )}

//           {/* Pointer */}
//           <div
//             ref={pointerRef}
//             className={`absolute w-8 h-8 rounded-full border-2 border-white pointer-events-none hidden transform -translate-x-1/2 -translate-y-1/2 ${
//               detectionMode === "hand" ? "bg-green-500" : "bg-orange-500"
//             } bg-opacity-70`}
//           />

//           {/* Result Display */}
//           <div
//             ref={resultRef}
//             className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-80 text-white px-4 py-2 rounded-lg text-lg font-medium max-w-xs text-center"
//           >
//             Loading...
//           </div>

//           {/* Warning Message */}
//           {warningMessage && (
//             <div className="absolute bottom-16 left-1/2 transform -translate-x-1/2 bg-orange-100 border border-orange-300 text-orange-800 px-3 py-2 rounded-lg text-lg font-medium max-w-xs text-center">
//               ⚠️ {warningMessage}
//             </div>
//           )}

//           {/* Instructions */}
//           {/* <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-80 text-white px-3 py-2 rounded-lg text-xs text-center max-w-xs">
//             <div className="mb-1">📱 Align poster with frame</div>
//             <div className="mb-1">👆 Point with index finger</div>
//             <div className="text-xs opacity-75">
//               Mode: {detectionMode} |
//               {detectionMode === "hand" ? " 🟢 " : " 🟠 "}
//             </div>
//           </div> */}
//         </div>
//       </div>

//       {/* Status Indicator */}
//       <div className="mt-4 w-full">
//         {posterInView ? (
//           <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-3">
//             <div className="w-3 h-3 bg-green-500 rounded-full"></div>
//             <div>
//               <p className="text-green-800 font-medium text-sm">
//                 Poster aligned
//               </p>
//               <p className="text-green-600 text-xs">
//                 Point to select your eating style
//               </p>
//             </div>
//           </div>
//         ) : (
//           <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 flex items-center gap-3">
//             <div className="w-3 h-3 bg-orange-500 rounded-full animate-pulse"></div>
//             <div>
//               <p className="text-orange-800 font-medium text-sm">
//                 Aligning poster...
//               </p>
//               <p className="text-orange-600 text-xs">Show all 4 markers</p>
//             </div>
//           </div>
//         )}
//       </div>

//       {/* Selection Toast */}
//       {showToast && detectedRegion && zoneInfo[detectedRegion] && (
//         <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
//           <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-2xl">
//             <div className="text-center mb-4">
//               {/* <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
//                 <span className="text-2xl">🍽️</span>
//               </div> */}
//               <h3 className="text-lg font-semibold text-gray-900 mb-2">
//                 Selection Detected
//               </h3>
//               <p className="text-gray-600">
//                 You selected:{" "}
//                 <span className="font-medium text-gray-900">
//                   {zoneInfo[detectedRegion]?.title || detectedRegion}
//                 </span>
//               </p>
//             </div>

//             <div className="flex gap-3">
//               <button
//                 onClick={handleRetry}
//                 disabled={isProcessing}
//                 className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors disabled:opacity-50"
//               >
//                 Retry
//               </button>
//               <button
//                 onClick={handleSubmit}
//                 disabled={isProcessing}
//                 className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
//               >
//                 {isProcessing ? (
//                   <>
//                     <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
//                     Submitting...
//                   </>
//                 ) : (
//                   "Submit"
//                 )}
//               </button>
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// };

// export default BMISelectionAppTailwind;
